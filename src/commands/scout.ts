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
import { resolveAgentModels } from "../config/models.js";
import { resolveWithFallback } from "../config/fallback.js";
import { getThread, updateThreadPhase, logModelUsage } from "../state/store.js";

const SCOUT_AGENTS = [
  "research-web-scout",
  "research-oss-scout",
  "research-repo-scout",
  "research-memory-scout",
] as const;

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

  // Resolve models (defaults + project override + fallback prompt)
  const defaults = await resolveAgentModels([...SCOUT_AGENTS], projectRoot);
  const models: Record<string, string> = {};
  for (const agent of SCOUT_AGENTS) {
    models[agent] = await resolveWithFallback(
      defaults[agent] as string,
      agent,
      ctx,
      projectRoot,
      activeThreadId
    );
  }

  // Build scout task specs with resolved models
  const specs = await Promise.all([
    buildWebScoutSpec(dir, brief, 1, models["research-web-scout"] as string),
    buildOssScoutSpec(dir, brief, 1, models["research-oss-scout"] as string),
    buildRepoScoutSpec(dir, brief, projectRoot, [], 1, models["research-repo-scout"] as string),
    buildMemoryScoutSpec(dir, brief, projectWing, 1, models["research-memory-scout"] as string),
  ]);

  // Advance phase and log model usage
  await updateThreadPhase(projectRoot, activeThreadId, "scout");
  const now = new Date().toISOString();
  for (const spec of specs) {
    await logModelUsage(projectRoot, activeThreadId, {
      agent: spec.agentName,
      model: spec.model,
      command: "scout",
      timestamp: now,
    });
  }

  ctx.ui.notify(
    `4 scouts dispatched in parallel.\n` +
    `  web + memory → ${models["research-web-scout"]}\n` +
    `  oss + repo → ${models["research-oss-scout"]}\n` +
    `When all done, run /research:groom`,
    "info"
  );

  pi.sendUserMessage(
    buildScoutInstruction(activeThreadId, dir, specs),
    { deliverAs: "followUp" }
  );
}
