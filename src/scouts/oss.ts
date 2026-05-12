import { loadPrompt } from "../lib/grill.js";
import { scoutOutputPath } from "./base.js";
import type { ScoutTaskSpec } from "./base.js";

export async function buildOssScoutSpec(
  threadDir: string,
  brief: string,
  index: number,
  model: string
): Promise<ScoutTaskSpec> {
  const prompt = await loadPrompt("scout-oss", { brief });
  return {
    agentName: "research-oss-scout",
    model,
    prompt,
    label: "oss",
    outputFile: scoutOutputPath(threadDir, `oss-${String(index).padStart(3, "0")}`, "oss"),
  };
}
