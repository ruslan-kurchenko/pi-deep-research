import { fileURLToPath } from "node:url";
import type { ScoutDefinition } from "../types.js";
import { SCOUT_API_VERSION } from "../types.js";

const HERE = new URL(".", import.meta.url);

const repoScout: ScoutDefinition = {
  scoutApiVersion: SCOUT_API_VERSION,
  version: "1.0.0",
  id: "repo",
  label: "Repo",
  description:
    "Reads the local project source — architecture, patterns, pain points — using read and bash tools",
  mcpTools: [],
  cliBinaries: ["git"],
  envVars: [],
  unavailableReason: "git not found (git is required for repo context)",
  agentProfile: fileURLToPath(new URL("../../../agents/research-repo-scout.md", HERE)),
  promptTemplate: fileURLToPath(new URL("../../../templates/prompts/scout-repo.md", HERE)),
  promptVariables: ["brief", "project_root", "relevant_paths"],
  defaultModel: "claude-haiku-4-5",
  agentName: "research-repo-scout",
  outputFilePattern: "repo-{n}-repo.md",
  requiredOutputSections: ["## Findings"],
  onUnavailable: "warn",

  async isAvailable(): Promise<boolean> {
    // git is virtually always present; skip the spawn for latency.
    // Doctor binary check covers the edge case in --deep mode.
    return true;
  },
};

export default repoScout;
