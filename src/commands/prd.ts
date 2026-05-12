import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir, slugify } from "../lib/paths.js";
import { buildPrdInstruction } from "../docs/instructions.js";
import { docDir, docOutputPath, nextDocNumber } from "../docs/docpaths.js";
import { resolveAgentModel } from "../config/models.js";
import { resolveWithFallback } from "../config/fallback.js";
import { buildOracleInstruction, buildOracleContext, ensureOracleDir } from "../docs/oracle.js";
import { appendOracleGate } from "../docs/oracle-gate.js";
import { getThread, updateThreadPhase, updateThreadLinks, logModelUsage, logOracleReview } from "../state/store.js";

export async function runPrd(
  _args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  projectRoot: string,
  activeThreadId: string
): Promise<void> {
  const thread = await getThread(projectRoot, activeThreadId);
  if (!thread) { ctx.ui.notify(`No active thread: ${activeThreadId}`, "error"); return; }

  const dir = threadDir(projectRoot, activeThreadId);
  const brief = (await readOptional(join(dir, "brief.md"))) ?? thread.topic;
  const synthesis = (await readOptional(join(dir, "synthesis.md"))) ?? "";
  const slug = slugify(thread.topic);
  const docNum = await nextDocNumber(projectRoot);
  const outputPath = docOutputPath(projectRoot, "prd", docNum, slug);
  const today = new Date().toISOString().slice(0, 10);

  // Collect all linked doc paths as references for the PRD
  const linked = thread.linkedDocs;
  const linkedPaths = [
    ...(linked.adr ?? []),
    ...(linked.rfc ? [linked.rfc] : []),
    ...(linked.designDoc ? [linked.designDoc] : []),
  ];

  await mkdir(docDir(projectRoot, "prd"), { recursive: true });
  await updateThreadPhase(projectRoot, activeThreadId, "docs");
  await updateThreadLinks(projectRoot, activeThreadId, { prd: outputPath });

  const oracleModel = await resolveWithFallback(
    await resolveAgentModel("research-oracle", projectRoot),
    "research-oracle", ctx, projectRoot, activeThreadId
  );
  await ensureOracleDir(dir);
  const now = new Date().toISOString();
  await logModelUsage(projectRoot, activeThreadId, { agent: "research-oracle", model: oracleModel, command: "prd:oracle", timestamp: now });
  await logOracleReview(projectRoot, activeThreadId, { gate: "after-doc", outputPath: join(dir, "oracle", "after-doc.md"), timestamp: now });
  const oracleCtx = await buildOracleContext(dir, "after-doc", outputPath);
  const oracleInst = await buildOracleInstruction(
    { threadId: activeThreadId, threadDir: dir, gate: "after-doc", brief, oracleModel }, oracleCtx
  );

  ctx.ui.notify(`Generating PRD → oracle (${oracleModel}) after…`, "info");

  pi.sendUserMessage(
    appendOracleGate(
      await buildPrdInstruction(
        { threadId: activeThreadId, threadDir: dir, brief, synthesis, alternatives: "", outputPath, docNum, slug, today },
        linkedPaths
      ),
      oracleInst
    ),
    { deliverAs: "followUp" }
  );
}
