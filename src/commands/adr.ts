import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir, slugify } from "../lib/paths.js";
import { buildAdrInstruction } from "../docs/instructions.js";
import { docDir, docOutputPath, nextDocNumber } from "../docs/docpaths.js";
import { getThread, updateThreadPhase, updateThreadLinks } from "../state/store.js";

export async function runAdr(
  args: string,
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
  const title = args.trim() || thread.topic;
  const slug = slugify(title);
  const docNum = await nextDocNumber(projectRoot);
  const outputPath = docOutputPath(projectRoot, "adr", docNum, slug);
  const today = new Date().toISOString().slice(0, 10);

  await mkdir(docDir(projectRoot, "adr"), { recursive: true });
  await updateThreadPhase(projectRoot, activeThreadId, "docs");

  const existing = thread.linkedDocs.adr ?? [];
  await updateThreadLinks(projectRoot, activeThreadId, {
    adr: [...existing, outputPath],
  });

  ctx.ui.notify(`Generating ADR-${String(docNum).padStart(3, "0")}…`, "info");

  pi.sendUserMessage(
    await buildAdrInstruction(
      { threadId: activeThreadId, threadDir: dir, brief, synthesis, alternatives, outputPath, docNum, slug, today },
      title
    ),
    { deliverAs: "followUp" }
  );
}
