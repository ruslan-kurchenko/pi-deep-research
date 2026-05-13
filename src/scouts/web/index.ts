import { fileURLToPath } from "node:url";
import type { ScoutDefinition } from "../types.js";
import { SCOUT_API_VERSION } from "../types.js";

// Resolve paths relative to this file so the module works from any install location.
const HERE = new URL(".", import.meta.url);

const webScout: ScoutDefinition = {
  scoutApiVersion: SCOUT_API_VERSION,
  version: "1.0.0",
  id: "web",
  label: "Web",
  description:
    "Searches vendor docs, engineering blogs, and conference talks via Exa and Context7 MCPs",
  mcpTools: ["exa_search", "context7_resolve_library_id"],
  cliBinaries: [],
  envVars: ["EXA_API_KEY"],
  unavailableReason: "EXA_API_KEY env var not set (Context7 is free; Exa enriches results)",
  agentProfile: fileURLToPath(new URL("../../../agents/research-web-scout.md", HERE)),
  promptTemplate: fileURLToPath(new URL("../../../templates/prompts/scout-web.md", HERE)),
  promptVariables: ["brief"],
  defaultModel: "claude-haiku-4-5",
  agentName: "research-web-scout",
  outputFilePattern: "web-{n}-web.md",
  requiredOutputSections: ["## Findings"],
  onUnavailable: "warn",

  async isAvailable(): Promise<boolean> {
    // Web scout is always available — Context7 is free and key-less.
    // EXA_API_KEY enriches results but is not required.
    // Doctor checks mcpTools in --deep mode for full validation.
    return true;
  },
};

export default webScout;
