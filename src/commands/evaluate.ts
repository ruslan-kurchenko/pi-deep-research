import { mkdir } from "node:fs/promises";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir, slugify } from "../lib/paths.js";
import { buildEvaluateInstruction } from "../docs/instructions.js";
import { docDir, docOutputPath, nextDocNumber } from "../docs/docpaths.js";
import { getThread, updateThreadPhase, updateThreadLinks } from "../state/store.js";
import { loadConfig } from "../config/config.js";

export async function runEvaluate(
  _args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  projectRoot: string,
  activeThreadId: string
): Promise<void> {
  const thread = await getThread(projectRoot, activeThreadId);
  if (!thread) { ctx.ui.notify(`No active thread: ${activeThreadId}`, "error"); return; }

  const contractPath = thread.linkedDocs.measurement;
  if (!contractPath) {
    ctx.ui.notify(
      "No measurement contract linked. Run /research:contract first.",
      "error"
    );
    return;
  }

  const contractContent = await readOptional(contractPath);
  if (!contractContent) {
    ctx.ui.notify(
      `Measurement contract not found at ${contractPath}. Has it been written?`,
      "error"
    );
    return;
  }

  const dir = threadDir(projectRoot, activeThreadId);
  const slug = slugify(thread.topic);
  const docNum = await nextDocNumber(projectRoot);
  const outputPath = docOutputPath(projectRoot, "evaluation", docNum, slug);
  const today = new Date().toISOString().slice(0, 10);

  // Detect adapter from env
  const adapterName =
    process.env["LANGFUSE_PUBLIC_KEY"] && process.env["LANGFUSE_SECRET_KEY"]
      ? "langfuse"
      : "manual";

  const config = await loadConfig(projectRoot);

  await mkdir(docDir(projectRoot, "evaluation"), { recursive: true });
  await updateThreadPhase(projectRoot, activeThreadId, "evaluate");
  await updateThreadLinks(projectRoot, activeThreadId, { evaluation: outputPath });

  ctx.ui.notify(
    `Generating evaluation report (adapter: ${adapterName})…`,
    "info"
  );

  pi.sendUserMessage(
    buildEvaluateInstruction(
      activeThreadId, contractPath, contractContent,
      outputPath, today, adapterName, projectRoot,
      config.mempalaceUrl
    ),
    { deliverAs: "followUp" }
  );
}
