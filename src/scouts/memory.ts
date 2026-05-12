import { loadPrompt } from "../lib/grill.js";
import { scoutOutputPath } from "./base.js";
import type { ScoutTaskSpec } from "./base.js";

export async function buildMemoryScoutSpec(
  threadDir: string,
  brief: string,
  projectWing: string,
  index: number
): Promise<ScoutTaskSpec> {
  const prompt = await loadPrompt("scout-memory", {
    brief,
    project_wing: projectWing,
  });
  return {
    agentName: "research-memory-scout",
    prompt,
    label: "memory",
    outputFile: scoutOutputPath(threadDir, `memory-${String(index).padStart(3, "0")}`, "memory"),
  };
}
