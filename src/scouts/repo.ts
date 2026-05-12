import { loadPrompt } from "../lib/grill.js";
import { scoutOutputPath } from "./base.js";
import type { ScoutTaskSpec } from "./base.js";

export async function buildRepoScoutSpec(
  threadDir: string,
  brief: string,
  projectRoot: string,
  relevantPaths: string[],
  index: number
): Promise<ScoutTaskSpec> {
  const prompt = await loadPrompt("scout-repo", {
    brief,
    project_root: projectRoot,
    relevant_paths:
      relevantPaths.length > 0
        ? relevantPaths.map((p) => `- ${p}`).join("\n")
        : "_Not specified — scout broadly._",
  });
  return {
    agentName: "research-repo-scout",
    prompt,
    label: "repo",
    outputFile: scoutOutputPath(threadDir, `repo-${String(index).padStart(3, "0")}`, "repo"),
  };
}
