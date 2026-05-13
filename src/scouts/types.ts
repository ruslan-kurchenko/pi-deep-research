/**
 * ScoutDefinition — the stable v1 plugin contract.
 *
 * A scout is an executable TypeScript module whose default export implements
 * this interface. The host loads scouts in two stages:
 *
 *   Stage 1 (first command): ESM dynamic import + interface validation.
 *              Runs during ensureInitialized(). Fast. No network calls.
 *   Stage 2 (before dispatch / doctor --deep): isAvailable() probe.
 *              Bounded by timeoutMs. Environment checks only — no network.
 *
 * Trust model (v1):
 *   Built-in scouts and project-local scouts (inside <projectRoot>/scouts/
 *   or <projectRoot>/examples/) are trusted by default.
 *   Paths outside those roots require config.allowExternalScouts: true.
 *   v1 protects against accidental execution, not malicious code.
 *   Sandboxing is deferred to v2.
 */

/** Current ScoutDefinition API version. Increment MAJOR for breaking changes. */
export const SCOUT_API_VERSION = 1 as const;

/** Normalized result from isAvailable() — always resolved to this shape by the host. */
export type AvailabilityResult =
  | { available: true; reason?: never }
  | { available: false; reason: string };

export interface ScoutDefinition {
  // ── Version ──────────────────────────────────────────────────────────────
  /**
   * Must equal SCOUT_API_VERSION at runtime.
   * Stored as number (not literal) so the loader can compare numerically
   * against older/newer scouts without TypeScript narrowing issues.
   * Scout authors write: `scoutApiVersion: 1`
   */
  readonly scoutApiVersion: number;

  /** Semver of this scout implementation. Displayed in /research:doctor. */
  readonly version: string;

  // ── Static identity ───────────────────────────────────────────────────────
  /** Unique across the registry. Used in filenames, config, and doctor output. */
  readonly id: string;

  /** Short human-readable name shown in /research:scout UI. */
  readonly label: string;

  /** One-sentence description shown in /research:doctor. */
  readonly description: string;

  // ── Declarative dependency metadata ──────────────────────────────────────
  /**
   * MCP tool names this scout requires.
   * Doctor checks these in --deep mode (best-effort via pi-mcp-adapter).
   */
  readonly mcpTools: readonly string[];

  /**
   * CLI binary names this scout requires.
   * Doctor checks these in --deep mode via cross-platform PATH lookup.
   */
  readonly cliBinaries: readonly string[];

  /**
   * Environment variable names this scout reads.
   * Documented for operators. Also used in isAvailable() by the scout itself.
   */
  readonly envVars: readonly string[];

  /** Human-readable reason shown when isAvailable() returns false. */
  readonly unavailableReason: string;

  // ── Agent and prompt ──────────────────────────────────────────────────────
  /** Absolute path to the agent profile .md file. Use fileURLToPath + import.meta.url. */
  readonly agentProfile: string;

  /** Absolute path to the prompt template .md file. Use fileURLToPath + import.meta.url. */
  readonly promptTemplate: string;

  /** {{varName}} placeholders expected in promptTemplate. */
  readonly promptVariables: readonly string[];

  // ── Model ─────────────────────────────────────────────────────────────────
  /** Default model in native pi ID format (e.g. "claude-haiku-4-5"). */
  readonly defaultModel: string;

  /** pi agent registry name (e.g. "research-web-scout"). */
  readonly agentName: string;

  // ── Output ────────────────────────────────────────────────────────────────
  /**
   * Filename pattern for the scout's raw output.
   * Tokens: {n} = zero-padded sequence number, {threadId} = thread ID slug.
   * Example: "web-{n}-web.md"
   */
  readonly outputFilePattern: string;

  /**
   * Section headings that should be present in the output.
   * Doctor warns (but does not fail) if any are missing.
   */
  readonly requiredOutputSections: readonly string[];

  // ── Execution policy ──────────────────────────────────────────────────────
  /**
   * Timeout in milliseconds for isAvailable() (Stage 2 probe).
   * @default 2000
   */
  readonly timeoutMs?: number;

  /**
   * What to do if isAvailable() returns false or times out.
   * @default "warn"
   */
  readonly onUnavailable?: "skip" | "warn" | "error";

  // ── Executable (Stage 2 only) ─────────────────────────────────────────────
  /**
   * Returns true/false or a structured result indicating whether this scout
   * can run in the current environment.
   *
   * Called in Stage 2 ONLY — NOT at import time.
   * Receives the scout's config slice from config.scouts[] (object form).
   * Check env vars, CLI binaries, file existence. No network calls.
   *
   * Return shapes:
   *   true / false                          → simple (most scouts)
   *   { available: true }                   → explicit positive
   *   { available: false; reason: string }  → structured negative (preferred)
   *
   * Throwing        → DoctorCheck "error" with thrown message
   * Timeout         → DoctorCheck "warn" with "timeout" reason
   */
  isAvailable(
    config?: unknown
  ): Promise<boolean | { available: true } | { available: false; reason: string }>;
}

/**
 * Normalize any raw return value from isAvailable() into an AvailabilityResult.
 * Also wraps thrown errors (caller must catch and call with the error message)
 * and timeout cases.
 */
export function normalizeAvailability(
  raw: boolean | { available: true } | { available: false; reason: string }
): AvailabilityResult {
  if (raw === true) return { available: true };
  if (raw === false) return { available: false, reason: "unavailable" };
  if (raw.available) return { available: true };
  const neg = raw as { available: false; reason: string };
  return { available: false, reason: neg.reason || "unavailable" };
}

/**
 * Validate that an imported module export looks like a ScoutDefinition.
 * Returns null if valid, or a human-readable error string if not.
 * This is the Stage 1 interface check — runs synchronously after dynamic import.
 */
export function validateScoutInterface(exported: unknown): string | null {
  if (!exported || typeof exported !== "object") {
    return "default export is not an object";
  }
  const s = exported as Record<string, unknown>;

  if (typeof s["scoutApiVersion"] !== "number") return "missing or non-number scoutApiVersion";
  if (typeof s["id"] !== "string" || !s["id"]) return "missing or empty id";
  if (typeof s["label"] !== "string") return "missing label";
  if (typeof s["description"] !== "string") return "missing description";
  if (!Array.isArray(s["mcpTools"])) return "mcpTools must be an array";
  if (!Array.isArray(s["cliBinaries"])) return "cliBinaries must be an array";
  if (!Array.isArray(s["envVars"])) return "envVars must be an array";
  if (typeof s["agentProfile"] !== "string") return "missing agentProfile";
  if (typeof s["promptTemplate"] !== "string") return "missing promptTemplate";
  if (!Array.isArray(s["promptVariables"])) return "promptVariables must be an array";
  if (typeof s["defaultModel"] !== "string") return "missing defaultModel";
  if (typeof s["agentName"] !== "string") return "missing agentName";
  if (typeof s["outputFilePattern"] !== "string") return "missing outputFilePattern";
  if (!Array.isArray(s["requiredOutputSections"])) return "requiredOutputSections must be an array";
  if (typeof s["isAvailable"] !== "function") return "missing isAvailable() method";

  return null; // valid
}

// ── Registry support types ───────────────────────────────────────────────────

/** Canonical form of a config.scouts[] entry (after normalization). */
export interface ScoutSpec {
  /**
   * Built-in id ("web", "oss", "repo") or resolved absolute path to a .js file.
   * Relative paths are resolved against projectRoot before use.
   */
  source: string;
  /** Opaque plugin config passed to isAvailable() and build*Spec(). */
  pluginConfig?: unknown;
}

/** Result of Stage 1 loading. */
export type LoadResult =
  | {
      ok: true;
      scout: ScoutDefinition;
      trustSource: "builtin" | "project-local" | "external";
    }
  | { ok: false; id: string; error: string };
