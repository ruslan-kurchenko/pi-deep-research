/**
 * Example custom scout: MemPalace memory retrieval
 *
 * Retrieves relevant prior decisions, experiments, and stack preferences
 * from the operator's MemPalace memory system.
 *
 * Prerequisites:
 *   MEMPALACE_URL env var — OR — set mempalaceUrl in config:
 *     .pi/deep-research/config.json → { "mempalaceUrl": "https://your-instance.com" }
 *
 * Auto-included in the scout roster when config.mempalaceUrl is set.
 * To add manually: { "scouts": ["examples/memory-mempalace/index.js"] }
 *
 * Trust: project-local — trusted by default (no allowExternalScouts needed).
 */
import { fileURLToPath } from "node:url";
import type { ScoutDefinition } from "../../src/scouts/types.js";
import { SCOUT_API_VERSION } from "../../src/scouts/types.js";

const HERE = new URL(".", import.meta.url);

const memoryScout: ScoutDefinition = {
  scoutApiVersion: SCOUT_API_VERSION,
  version: "1.0.0",
  id: "memory-mempalace",
  label: "Memory (MemPalace)",
  description:
    "Retrieves prior decisions and preferences from the MemPalace memory system",
  mcpTools: ["mempalace_search", "mempalace_status"],
  cliBinaries: [],
  envVars: ["MEMPALACE_URL"],
  unavailableReason: "MEMPALACE_URL not set. Set config.mempalaceUrl or MEMPALACE_URL env var.",
  agentProfile: fileURLToPath(new URL("../../agents/research-memory-scout.md", HERE)),
  promptTemplate: fileURLToPath(new URL("../../templates/prompts/scout-memory.md", HERE)),
  promptVariables: ["brief", "project_wing"],
  defaultModel: "claude-haiku-4-5",
  agentName: "research-memory-scout",
  outputFilePattern: "memory-{n}-memory.md",
  requiredOutputSections: ["## Prior decisions", "## Relevant context"],
  timeoutMs: 3000,
  onUnavailable: "skip", // never block research if memory is unavailable

  async isAvailable(
    config?: unknown
  ): Promise<boolean | { available: false; reason: string }> {
    // Accept mempalaceUrl from the opaque plugin config slice OR from env var.
    const mempalaceUrl =
      (config as { mempalaceUrl?: string } | undefined)?.mempalaceUrl ??
      process.env["MEMPALACE_URL"];
    if (!mempalaceUrl) {
      return { available: false, reason: "MEMPALACE_URL not set" };
    }
    return true;
  },
};

export default memoryScout;
