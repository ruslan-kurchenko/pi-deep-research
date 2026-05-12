import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir } from "../lib/paths.js";
import { buildDocAdvisorInstruction } from "../docs/instructions.js";
import { getThread } from "../state/store.js";

export async function runDocument(
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

  ctx.ui.notify("Asking doc-advisor for format recommendation…", "info");

  pi.sendUserMessage(
    await buildDocAdvisorInstruction(
      activeThreadId,
      dir,
      brief,
      alternatives.slice(0, 2000)
    ),
    { deliverAs: "followUp" }
  );
}
