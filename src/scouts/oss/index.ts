import { fileURLToPath } from "node:url";
import type { ScoutDefinition } from "../types.js";
import { SCOUT_API_VERSION } from "../types.js";

const HERE = new URL(".", import.meta.url);

const ossScout: ScoutDefinition = {
  scoutApiVersion: SCOUT_API_VERSION,
  version: "1.0.0",
  id: "oss",
  label: "OSS",
  description:
    "Finds production open-source implementations via GitHub search (gh CLI + librarian MCP)",
  mcpTools: ["librarian"],
  cliBinaries: ["gh"],
  envVars: [],
  unavailableReason: "gh CLI not installed or not authenticated. Run: gh auth login",
  agentProfile: fileURLToPath(new URL("../../../agents/research-oss-scout.md", HERE)),
  promptTemplate: fileURLToPath(new URL("../../../templates/prompts/scout-oss.md", HERE)),
  promptVariables: ["brief"],
  defaultModel: "claude-haiku-4-5",
  agentName: "research-oss-scout",
  outputFilePattern: "oss-{n}-oss.md",
  requiredOutputSections: ["## Findings"],
  onUnavailable: "warn",

  async isAvailable(): Promise<boolean | { available: false; reason: string }> {
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      await promisify(execFile)("gh", ["--version"], { timeout: 2000 });
      return true;
    } catch {
      return { available: false, reason: "gh CLI not found. Install: https://cli.github.com" };
    }
  },
};

export default ossScout;
