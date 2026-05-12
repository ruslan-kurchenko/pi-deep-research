import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional, readRawScouts } from "../lib/files.js";
import { threadDir } from "../lib/paths.js";
import { buildGroomInstruction } from "../synthesis/instructions.js";
import { getThread, updateThreadPhase } from "../state/store.js";

export async function runGroom(
  _args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  projectRoot: string,
  activeThreadId: string
): Promise<void> {
  const thread = await getThread(projectRoot, activeThreadId);
  if (!thread) {
    ctx.ui.notify(`No active thread: ${activeThreadId}`, "error");
    return;
  }

  const dir = threadDir(projectRoot, activeThreadId);

  // Check raw scouts exist
  const rawScouts = await readRawScouts(dir);
  if (rawScouts === "_No files found._") {
    ctx.ui.notify(
      "No scout outputs found in raw/. Run /research:scout first and wait for it to complete.",
      "error"
    );
    return;
  }

  // Allow re-groom from scout or groom phase
  if (thread.phase !== "scout" && thread.phase !== "groom") {
    const ok = await ctx.ui.confirm(
      "Re-run groom?",
      `Thread is in phase '${thread.phase}'. Re-run synthesis and overwrite synthesis.md?`
    );
    if (!ok) return;
  }

  const brief = (await readOptional(join(dir, "brief.md"))) ?? thread.topic;

  await updateThreadPhase(projectRoot, activeThreadId, "groom");

  ctx.ui.notify("Dispatching synthesizer…", "info");

  pi.sendUserMessage(
    await buildGroomInstruction(activeThreadId, dir, brief, rawScouts),
    { deliverAs: "followUp" }
  );
}
