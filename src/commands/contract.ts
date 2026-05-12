import { mkdir } from "node:fs/promises";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir, slugify } from "../lib/paths.js";
import { buildContractInstruction } from "../docs/instructions.js";
import { docDir, docOutputPath, nextDocNumber } from "../docs/docpaths.js";
import { getThread, updateThreadLinks } from "../state/store.js";

export async function runContract(
  _args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  projectRoot: string,
  activeThreadId: string
): Promise<void> {
  const thread = await getThread(projectRoot, activeThreadId);
  if (!thread) { ctx.ui.notify(`No active thread: ${activeThreadId}`, "error"); return; }

  const dir = threadDir(projectRoot, activeThreadId);

  // Find the primary linked doc (design-doc > rfc > adr[0])
  const linked = thread.linkedDocs;
  const primaryDocPath =
    linked.designDoc ??
    linked.rfc ??
    (linked.adr && linked.adr.length > 0 ? linked.adr[0] : null);

  if (!primaryDocPath) {
    ctx.ui.notify(
      "No linked design doc, RFC, or ADR found. Generate a document first (/research:design-doc, /research:rfc, or /research:adr).",
      "error"
    );
    return;
  }

  const linkedDocContent = (await readOptional(primaryDocPath)) ?? "";
  const synthesis = (await readOptional(`${dir}/synthesis.md`)) ?? "";
  const slug = slugify(thread.topic);
  const docNum = await nextDocNumber(projectRoot);
  const outputPath = docOutputPath(projectRoot, "measurement", docNum, slug);
  const today = new Date().toISOString().slice(0, 10);

  await mkdir(docDir(projectRoot, "measurement"), { recursive: true });
  await updateThreadLinks(projectRoot, activeThreadId, { measurement: outputPath });

  ctx.ui.notify("Generating measurement contract…", "info");

  pi.sendUserMessage(
    await buildContractInstruction(
      activeThreadId, dir, primaryDocPath, linkedDocContent,
      synthesis, outputPath, docNum, slug, today
    ),
    { deliverAs: "followUp" }
  );
}
