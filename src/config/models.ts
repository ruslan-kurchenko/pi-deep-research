import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ── Canonical defaults (mirrors agent profile frontmatter) ───────────────────
// Haiku 4.5    → trivial tasks: query, fetch, classify
// Sonnet 4.6   → reasoning tasks: code reading, synthesis, metric design
// Gemini 3.1 Pro → cross-family adversarial review
// GPT-5.5      → cross-family oracle, highest reasoning bar

export const AGENT_MODEL_DEFAULTS: Record<string, string> = {
  "research-memory-scout":    "anthropic/claude-haiku-4.5",
  "research-web-scout":       "anthropic/claude-haiku-4.5",
  "research-repo-scout":      "anthropic/claude-sonnet-4.6",
  "research-oss-scout":       "anthropic/claude-sonnet-4.6",
  "research-synthesizer":     "anthropic/claude-sonnet-4.6",
  "research-challenger":      "google/gemini-3.1-pro-preview",
  "research-devils-advocate": "google/gemini-3.1-pro-preview",
  "research-doc-advisor":     "anthropic/claude-haiku-4.5",
  "research-kpi-architect":   "anthropic/claude-sonnet-4.6",
  "research-architect":       "anthropic/claude-sonnet-4.6",
  "research-oracle":          "openai/gpt-5.5",
};

/** Hard fallback chain when a provider isn't available. Never reaches index 0 in healthy setup. */
export const FALLBACK_CHAIN = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
];

// ── Project config ────────────────────────────────────────────────────────────

export interface ModelsConfig {
  agents: Record<string, string>;
}

const MODELS_CONFIG_PATH = ".pi/deep-research/models.json";

export async function loadModelsConfig(projectRoot: string): Promise<ModelsConfig> {
  try {
    const raw = await readFile(join(projectRoot, MODELS_CONFIG_PATH), "utf8");
    return JSON.parse(raw) as ModelsConfig;
  } catch {
    return { agents: {} };
  }
}

/**
 * Resolve the model to use for an agent.
 * Resolution order (later wins):
 *   1. AGENT_MODEL_DEFAULTS (hardcoded)
 *   2. .pi/deep-research/models.json project override
 */
export async function resolveAgentModel(
  agentName: string,
  projectRoot: string
): Promise<string> {
  const config = await loadModelsConfig(projectRoot);
  return (
    config.agents[agentName] ??
    AGENT_MODEL_DEFAULTS[agentName] ??
    FALLBACK_CHAIN[0] as string  // belt-and-suspenders, should never hit
  ) as string;
}

/** Resolve models for multiple agents at once. */
export async function resolveAgentModels(
  agentNames: string[],
  projectRoot: string
): Promise<Record<string, string>> {
  const config = await loadModelsConfig(projectRoot);
  return Object.fromEntries(
    agentNames.map((name): [string, string] => [
      name,
      (config.agents[name] ?? AGENT_MODEL_DEFAULTS[name] ?? FALLBACK_CHAIN[0]) as string,
    ])
  ) as Record<string, string>;
}
