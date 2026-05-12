import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { threadDir } from "../lib/paths.js";
import { runScoutsParallel, formatScoutSummary } from "../scouts/base.js";
import { buildWebScoutTask } from "../scouts/web.js";
import { buildOssScoutTask } from "../scouts/oss.js";
import { buildRepoScoutTask } from "../scouts/repo.js";
import { buildMemoryScoutTask } from "../scouts/memory.js";
import { getThread, updateThreadPhase } from "../state/store.js";
import type { SubagentTool } from "../scouts/base.js";

export async function runScout(
  _args: string,
  ctx: ExtensionCommandContext,
  projectRoot: string,
  activeThreadId: string,
  subagent: SubagentTool,
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

  ctx.ui.setStatus("research", "🔬 scouts dispatching...");

  const tasks = await Promise.all([
    buildWebScoutTask(dir, brief, 1),
    buildOssScoutTask(dir, brief, 1),
    buildRepoScoutTask(dir, brief, projectRoot, [], 1),
    buildMemoryScoutTask(dir, brief, projectWing, 1),
  ]);

  const results = await runScoutsParallel(subagent, tasks);
  const summary = formatScoutSummary(results);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (succeeded > 0) {
    await updateThreadPhase(projectRoot, activeThreadId, "scout");
  }

  ctx.ui.setStatus("research", "");
  ctx.ui.notify(
    [
      `Scouts complete: ${succeeded} succeeded, ${failed} failed`,
      summary,
      "",
      succeeded > 0 ? "Run /research:groom to synthesize findings." : "Fix scout errors and retry.",
    ].join("\n"),
    succeeded > 0 ? "info" : "error"
  );
}
