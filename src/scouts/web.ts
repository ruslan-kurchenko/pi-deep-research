import { loadPrompt } from "../lib/grill.js";
import { scoutOutputPath } from "./base.js";
import type { ScoutTask } from "./base.js";

export async function buildWebScoutTask(
  threadDir: string,
  brief: string,
  index: number
): Promise<ScoutTask> {
  const task = await loadPrompt("scout-web", { brief });
  return {
    agentName: "research-web-scout",
    task,
    outputFile: scoutOutputPath(threadDir, `web-${String(index).padStart(3, "0")}`, "web"),
  };
}
