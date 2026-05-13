/**
 * Example custom scout: GitHub Trending Repositories
 *
 * Finds trending GitHub repositories related to the research brief using
 * the gh CLI. No API keys required — just a GitHub login.
 *
 * Prerequisites: gh CLI installed and authenticated.
 *   Install: https://cli.github.com
 *   Auth:    gh auth login
 *
 * To enable: add to .pi/deep-research/config.json:
 *   { "scouts": ["examples/github-trends/index.js"] }
 *
 * Trust: project-local — trusted by default (no allowExternalScouts needed).
 */
import { fileURLToPath } from "node:url";
import type { ScoutDefinition } from "../../src/scouts/types.js";
import { SCOUT_API_VERSION } from "../../src/scouts/types.js";

const HERE = new URL(".", import.meta.url);

const githubTrendsScout: ScoutDefinition = {
  scoutApiVersion: SCOUT_API_VERSION,
  version: "1.0.0",
  id: "github-trends",
  label: "GitHub Trends",
  description:
    "Finds trending GitHub repos related to the brief using gh CLI — no API key required",
  mcpTools: [],
  cliBinaries: ["gh"],
  envVars: [],
  unavailableReason: "gh CLI not installed or not authenticated. Run: gh auth login",
  agentProfile: fileURLToPath(new URL("./agent.md", HERE)),
  promptTemplate: fileURLToPath(new URL("./prompt.md", HERE)),
  promptVariables: ["brief"],
  defaultModel: "claude-haiku-4-5",
  agentName: "research-github-trends-scout",
  outputFilePattern: "github-trends-{n}-github-trends.md",
  requiredOutputSections: ["## Trending repos"],
  onUnavailable: "warn",

  async isAvailable(): Promise<boolean | { available: false; reason: string }> {
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      await promisify(execFile)("gh", ["auth", "status"], { timeout: 2000 });
      return true;
    } catch {
      return {
        available: false,
        reason: "gh CLI not authenticated. Run: gh auth login",
      };
    }
  },
};

export default githubTrendsScout;
