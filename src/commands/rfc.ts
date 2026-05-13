import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir, slugify } from "../lib/paths.js";
import { buildRfcInstruction } from "../docs/instructions.js";
import { docDir, docOutputPath, nextDocNumber } from "../docs/docpaths.js";
import { resolveAgentModel } from "../config/models.js";
import { resolveWithFallback } from "../config/fallback.js";
import { buildOracleInstruction, buildOracleContext, ensureOracleDir } from "../docs/oracle.js";
import { appendOracleGate } from "../docs/oracle-gate.js";
import { getThread, updateThreadPhase, updateThreadLinks, logModelUsage, logOracleReview } from "../state/store.js";

export async function runRfc(
  _args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  projectRoot: string,
  activeThreadId: string
): Promise<void> {
  const thread = await getThread(projectRoot, activeThreadId);
  if (!thread) { ctx.ui.notify(`No active thread: ${activeThreadId}`, "error"); return; }

  const dir = threadDir(projectRoot, activeThreadId);
  const alternatives = (await readOptional(join(dir, "alternatives.md"))) ?? "";

  const brief = (await readOptional(join(dir, "brief.md"))) ?? thread.topic;
  const synthesis = (await readOptional(join(dir, "synthesis.md"))) ?? "";
  const slug = slugify(thread.topic);
  const docNum = await nextDocNumber(projectRoot);
  const outputPath = docOutputPath(projectRoot, "rfc", docNum, slug);
  const today = new Date().toISOString().slice(0, 10);

  await mkdir(docDir(projectRoot, "rfc"), { recursive: true });
  await updateThreadPhase(projectRoot, activeThreadId, "docs");
  await updateThreadLinks(projectRoot, activeThreadId, { rfc: outputPath });

  const oracleModel = await resolveWithFallback(
    await resolveAgentModel("research-oracle", projectRoot),
    "research-oracle", ctx, projectRoot, activeThreadId
  );
  await ensureOracleDir(dir);
  const now = new Date().toISOString();
  await logModelUsage(projectRoot, activeThreadId, { agent: "research-oracle", model: oracleModel, command: "rfc:oracle", timestamp: now });
  await logOracleReview(projectRoot, activeThreadId, { gate: "after-doc", outputPath: join(dir, "oracle", "after-doc.md"), timestamp: now });
  const oracleCtx = await buildOracleContext(dir, "after-doc", outputPath);
  const oracleInst = await buildOracleInstruction(
    { threadId: activeThreadId, threadDir: dir, gate: "after-doc", brief, oracleModel }, oracleCtx
  );

  ctx.ui.notify(`Generating RFC-${String(docNum).padStart(3, "0")} → oracle (${oracleModel}) after…`, "info");

  pi.sendUserMessage(
    appendOracleGate(
      await buildRfcInstruction({ threadId: activeThreadId, threadDir: dir, brief, synthesis, alternatives, outputPath, docNum, slug, today, projectRoot }),
      oracleInst
    ),
    { deliverAs: "followUp" }
  );
}
