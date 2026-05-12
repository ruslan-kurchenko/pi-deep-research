import { loadPrompt } from "../lib/grill.js";
import { scoutOutputPath } from "./base.js";
import type { ScoutTask } from "./base.js";

export async function buildOssScoutTask(
  threadDir: string,
  brief: string,
  index: number
): Promise<ScoutTask> {
  const task = await loadPrompt("scout-oss", { brief });
  return {
    agentName: "research-oss-scout",
    task,
    outputFile: scoutOutputPath(threadDir, `oss-${String(index).padStart(3, "0")}`, "oss"),
  };
}
