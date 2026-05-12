import { loadPrompt } from "../lib/grill.js";
import { scoutOutputPath } from "./base.js";
import type { ScoutTaskSpec } from "./base.js";

export async function buildWebScoutSpec(
  threadDir: string,
  brief: string,
  index: number,
  model: string
): Promise<ScoutTaskSpec> {
  const prompt = await loadPrompt("scout-web", { brief });
  return {
    agentName: "research-web-scout",
    model,
    prompt,
    label: "web",
    outputFile: scoutOutputPath(threadDir, `web-${String(index).padStart(3, "0")}`, "web"),
  };
}
