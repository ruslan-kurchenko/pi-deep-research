import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ProviderStatus {
  available: boolean;
  provider: string;
  reason?: string;
}

/**
 * Derive the provider prefix from a model ID like "anthropic/claude-haiku-4.5".
 * Returns "anthropic", "openai", "google", etc.
 */
export function providerFromModel(modelId: string): string {
  const slash = modelId.indexOf("/");
  return slash >= 0 ? modelId.slice(0, slash) : modelId;
}

/**
 * Check whether the provider for a given model ID is configured via env or auth.json.
 * Does NOT make any network calls — purely local credential inspection.
 */
export async function checkProvider(modelId: string): Promise<ProviderStatus> {
  const provider = providerFromModel(modelId);

  switch (provider) {
    case "anthropic":
      return process.env["ANTHROPIC_API_KEY"]
        ? { available: true, provider }
        : { available: false, provider, reason: "ANTHROPIC_API_KEY not set" };

    case "openai":
      return process.env["OPENAI_API_KEY"]
        ? { available: true, provider }
        : { available: false, provider, reason: "OPENAI_API_KEY not set" };

    case "google": {
      // Google can come from env var OR auth.json
      if (process.env["GEMINI_API_KEY"]) return { available: true, provider };
      const fromAuth = await readGoogleAuthKey();
      return fromAuth
        ? { available: true, provider }
        : {
            available: false,
            provider,
            reason:
              "GEMINI_API_KEY not set and no Google key in ~/.pi/agent/auth.json. " +
              "Get a free key from https://aistudio.google.com/apikey",
          };
    }

    default:
      // Unknown provider — assume available (custom or local model)
      return { available: true, provider };
  }
}

async function readGoogleAuthKey(): Promise<boolean> {
  try {
    const authPath = join(homedir(), ".pi", "agent", "auth.json");
    const raw = await readFile(authPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return !!parsed["google"];
  } catch {
    return false;
  }
}
