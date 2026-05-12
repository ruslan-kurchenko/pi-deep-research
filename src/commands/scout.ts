import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { threadDir } from "../lib/paths.js";
import { buildScoutInstruction } from "../scouts/base.js";
import { buildWebScoutSpec } from "../scouts/web.js";
import { buildOssScoutSpec } from "../scouts/oss.js";
import { buildRepoScoutSpec } from "../scouts/repo.js";
import { buildMemoryScoutSpec } from "../scouts/memory.js";
import { getThread, updateThreadPhase } from "../state/store.js";

export async function runScout(
  _args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  projectRoot: string,
  activeThreadId: string,
  projectWing: string
): Promise<void> {
  const thread = await getThread(projectRoot, activeThreadId);
  if (!thread) {
    ctx.ui.notify(`No active thread found: ${activeThreadId}`, "error");
    return;
  }

  if (thread.phase !== "brief") {
    const ok = await ctx.ui.confirm(
      "Scout already ran",
      `Thread is in phase '${thread.phase}'. Re-run scouts and overwrite raw findings?`
    );
    if (!ok) return;
  }

  const dir = threadDir(projectRoot, activeThreadId);
  const briefPath = join(dir, "brief.md");
  let brief: string;
  try {
    brief = await readFile(briefPath, "utf8");
  } catch {
    ctx.ui.notify("brief.md not found. Run /research:new first.", "error");
    return;
  }

  // Build all 4 scout task specs (prompt content + output paths)
  const specs = await Promise.all([
    buildWebScoutSpec(dir, brief, 1),
    buildOssScoutSpec(dir, brief, 1),
    buildRepoScoutSpec(dir, brief, projectRoot, [], 1),
    buildMemoryScoutSpec(dir, brief, projectWing, 1),
  ]);

  // Advance phase now — scouts are in flight
  await updateThreadPhase(projectRoot, activeThreadId, "scout");

  ctx.ui.notify(
    `4 scouts dispatched in parallel. Watch for subagent activity above.\nWhen all done, run /research:groom`,
    "info"
  );

  // Hand off to the LLM — it drives pi-subagents + writes files
  pi.sendUserMessage(
    buildScoutInstruction(activeThreadId, dir, specs),
    { deliverAs: "followUp" }
  );
}
