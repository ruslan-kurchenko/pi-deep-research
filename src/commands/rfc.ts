import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir, slugify } from "../lib/paths.js";
import { buildRfcInstruction } from "../docs/instructions.js";
import { docDir, docOutputPath, nextDocNumber } from "../docs/docpaths.js";
import { getThread, updateThreadPhase, updateThreadLinks } from "../state/store.js";

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
  const alternatives = await readOptional(join(dir, "alternatives.md"));
  if (!alternatives) {
    ctx.ui.notify("alternatives.md not found. Run /research:alternatives first.", "error");
    return;
  }

  const brief = (await readOptional(join(dir, "brief.md"))) ?? thread.topic;
  const synthesis = (await readOptional(join(dir, "synthesis.md"))) ?? "";
  const slug = slugify(thread.topic);
  const docNum = await nextDocNumber(projectRoot);
  const outputPath = docOutputPath(projectRoot, "rfc", docNum, slug);
  const today = new Date().toISOString().slice(0, 10);

  await mkdir(docDir(projectRoot, "rfc"), { recursive: true });
  await updateThreadPhase(projectRoot, activeThreadId, "docs");
  await updateThreadLinks(projectRoot, activeThreadId, { rfc: outputPath });

  ctx.ui.notify(`Generating RFC-${String(docNum).padStart(3, "0")}…`, "info");

  pi.sendUserMessage(
    await buildRfcInstruction({ threadId: activeThreadId, threadDir: dir, brief, synthesis, alternatives, outputPath, docNum, slug, today }),
    { deliverAs: "followUp" }
  );
}
