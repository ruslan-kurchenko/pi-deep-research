import { loadPrompt } from "../lib/grill.js";
import { scoutOutputPath } from "./base.js";
import type { ScoutTask } from "./base.js";

export async function buildMemoryScoutTask(
  threadDir: string,
  brief: string,
  projectWing: string,
  index: number
): Promise<ScoutTask> {
  const task = await loadPrompt("scout-memory", {
    brief,
    project_wing: projectWing,
  });
  return {
    agentName: "research-memory-scout",
    task,
    outputFile: scoutOutputPath(threadDir, `memory-${String(index).padStart(3, "0")}`, "memory"),
  };
}
