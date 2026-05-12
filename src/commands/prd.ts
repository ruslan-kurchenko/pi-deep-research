import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir, slugify } from "../lib/paths.js";
import { buildPrdInstruction } from "../docs/instructions.js";
import { docDir, docOutputPath, nextDocNumber } from "../docs/docpaths.js";
import { getThread, updateThreadPhase, updateThreadLinks } from "../state/store.js";

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

  ctx.ui.notify("Generating PRD…", "info");

  pi.sendUserMessage(
    await buildPrdInstruction(
      { threadId: activeThreadId, threadDir: dir, brief, synthesis, alternatives: "", outputPath, docNum, slug, today },
      linkedPaths
    ),
    { deliverAs: "followUp" }
  );
}
