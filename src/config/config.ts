import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface DeepResearchConfig {
  /** MemPalace API base URL. When absent, memory scout is disabled and
   *  evaluate does not call mempalace_add_drawer. */
  mempalaceUrl?: string;
  /** Author name for generated docs. Falls back to git config user.name then "Unknown". */
  user?: { name?: string };
  /** Override agent model assignments. Keys are agent names. */
  models?: Record<string, string>;
}

/**
 * Load config from <projectRoot>/.pi/deep-research/config.json.
 * Returns empty object if file missing or invalid JSON. Never throws.
 */
export async function loadConfig(projectRoot: string): Promise<DeepResearchConfig> {
  const configPath = join(projectRoot, ".pi", "deep-research", "config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw) as DeepResearchConfig;
  } catch {
    return {};
  }
}
