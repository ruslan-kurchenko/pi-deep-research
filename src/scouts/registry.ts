import { realpath } from "node:fs/promises";
import { extname, join } from "node:path";
import type { DeepResearchConfig } from "../config/config.js";
import {
  SCOUT_API_VERSION,
  type AvailabilityResult,
  type LoadResult,
  type ScoutDefinition,
  type ScoutSpec,
} from "./types.js";

// ── Trust classification ───────────────────────────────────────────────────

/**
 * Classify the trust source of a resolved scout path.
 *
 * - builtin:       path is inside this extension's own src/scouts/ tree
 * - project-local: path is inside <projectRoot>/scouts/ or <projectRoot>/examples/
 * - external:      everything else
 *
 * NOTE: uses real canonical paths — callers must pass realpath-resolved paths.
 */
export function normalizeTrustSource(
  resolvedPath: string,
  projectRoot: string,
): "builtin" | "project-local" | "external" {
  // Built-in: this file lives at src/scouts/registry.ts; built-in scouts are
  // siblings inside src/scouts/. Use the directory of this module as the anchor.
  const extensionScoutsDir = new URL("./", import.meta.url).pathname;
  if (resolvedPath.startsWith(extensionScoutsDir)) return "builtin";

  // Project-local: inside <projectRoot>/scouts/ or <projectRoot>/examples/
  const sep = projectRoot.endsWith("/") ? "" : "/";
  const projectScouts = `${projectRoot}${sep}scouts/`;
  const projectExamples = `${projectRoot}${sep}examples/`;
  if (resolvedPath.startsWith(projectScouts) || resolvedPath.startsWith(projectExamples)) {
    return "project-local";
  }

  return "external";
}

/**
 * Throw if a scout path is classified as external but
 * `config.allowExternalScouts` is not explicitly true.
 */
export function enforceTrustBoundary(
  resolvedPath: string,
  trustSource: "builtin" | "project-local" | "external",
  config: DeepResearchConfig,
): void {
  if (trustSource === "external" && !config.allowExternalScouts) {
    throw new Error(
      `External scout '${resolvedPath}' requires config.allowExternalScouts: true. ` +
        `Only enable in trusted workspaces. See docs/CUSTOM-SCOUTS.md.`,
    );
  }
}

// ── Stage 1: import + validate ─────────────────────────────────────────────

/**
 * Stage 1 loader: import a scout module and validate its interface.
 *
 * Safety note: the import timeout (5 s) is a DIAGNOSTIC backstop — it lets
 * /research:doctor surface a hung import instead of silently freezing. It is
 * NOT a security boundary; synchronous top-level code, CPU loops, and side
 * effects are not interrupted by Promise.race. The trust-boundary check above
 * (allowExternalScouts gating) is the actual safety mechanism for v1.
 *
 * Failure table:
 *   - Slow async top-level await   → timeout fires, LoadResult error
 *   - Synchronous CPU loop         → NOT caught; import blocks the event loop
 *   - Side effects at import time  → already executed before timeout fires
 *   - Memory exhaustion            → NOT caught
 */
export async function loadScout(
  source: string,
  projectRoot: string,
  config: DeepResearchConfig,
): Promise<LoadResult> {
  // Reject .ts files immediately (must be pre-compiled)
  if (extname(source) === ".ts") {
    return {
      ok: false,
      id: source,
      error:
        ".ts files cannot be imported at runtime. Compile to .js first; see docs/CUSTOM-SCOUTS.md.",
    };
  }

  // Resolve real path (follows symlinks — prevents path-traversal bypasses)
  let resolvedPath: string;
  try {
    resolvedPath = await realpath(source);
  } catch {
    return { ok: false, id: source, error: `Path not found: ${source}` };
  }

  // Reject .ts after realpath too (symlink could point to a .ts file)
  if (extname(resolvedPath) === ".ts") {
    return {
      ok: false,
      id: resolvedPath,
      error:
        ".ts files cannot be imported at runtime. Compile to .js first; see docs/CUSTOM-SCOUTS.md.",
    };
  }

  // Trust classification and boundary enforcement
  const trustSource = normalizeTrustSource(resolvedPath, projectRoot);
  try {
    enforceTrustBoundary(resolvedPath, trustSource, config);
  } catch (e) {
    return { ok: false, id: source, error: String(e) };
  }

  // Stage 1 import with 5 s diagnostic timeout
  const importPromise = (import(resolvedPath) as Promise<{ default: ScoutDefinition }>).then(
    (m) => m.default,
  );
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Stage 1 import timed out after 5000ms (diagnostic backstop)")),
      5000,
    ),
  );

  let scout: ScoutDefinition;
  try {
    scout = await Promise.race([importPromise, timeoutPromise]);
  } catch (e) {
    return { ok: false, id: source, error: `Import failed: ${String(e)}` };
  }

  // Interface validation — duck-type check on id field
  if (!scout || typeof scout !== "object" || typeof (scout as Record<string, unknown>)["id"] !== "string") {
    return {
      ok: false,
      id: source,
      error: "Module default export is not a valid ScoutDefinition (missing or non-string id field)",
    };
  }

  // API version check
  if (typeof scout.scoutApiVersion !== "number") {
    return {
      ok: false,
      id: scout.id,
      error: `scoutApiVersion must be a number, got ${typeof scout.scoutApiVersion}`,
    };
  }

  if (scout.scoutApiVersion > SCOUT_API_VERSION) {
    return {
      ok: false,
      id: scout.id,
      error:
        `Scout '${scout.id}' declares scoutApiVersion ${scout.scoutApiVersion} but this ` +
        `extension only supports ${SCOUT_API_VERSION}. Upgrade the extension.`,
    };
  }
  // scoutApiVersion < SCOUT_API_VERSION → warn at doctor level but load (best-effort)

  return { ok: true, scout, trustSource };
}

// ── Stage 2: availability probe ────────────────────────────────────────────

/**
 * Stage 2 probe: call isAvailable() with a bounded timeout.
 * Normalizes all return shapes into AvailabilityResult.
 */
export async function probeAvailability(
  scout: ScoutDefinition,
  pluginConfig?: unknown,
): Promise<AvailabilityResult> {
  const timeoutMs = scout.timeoutMs ?? 2000;

  const probePromise: Promise<AvailabilityResult> = scout.isAvailable(pluginConfig).then(
    (result): AvailabilityResult => {
      if (result === true) return { available: true, reason: "ok" };
      if (result === false) return { available: false, reason: "false" };
      // Structured return
      if (result.available) return { available: true, reason: "ok" };
      return {
        available: false,
        reason: "false",
        detail: (result as { available: false; reason: string }).reason,
      };
    },
    (e): AvailabilityResult => ({ available: false, reason: "error", detail: String(e) }),
  );

  const timeoutResult: Promise<AvailabilityResult> = new Promise((resolve) =>
    setTimeout(
      () => resolve({ available: false, reason: "timeout", detail: `Probe exceeded ${timeoutMs}ms` }),
      timeoutMs,
    ),
  );

  return Promise.race([probePromise, timeoutResult]);
}

// ── Registry ───────────────────────────────────────────────────────────────

export interface RegistryEntry {
  scout: ScoutDefinition;
  trustSource: "builtin" | "project-local" | "external";
  pluginConfig?: unknown;
  loadError?: undefined;
}

export interface FailedEntry {
  id: string;
  loadError: string;
  trustSource?: undefined;
}

export type AnyEntry = RegistryEntry | FailedEntry;

export class ScoutRegistry {
  private readonly entries: AnyEntry[] = [];

  add(entry: AnyEntry): void {
    this.entries.push(entry);
  }

  getLoaded(): RegistryEntry[] {
    return this.entries.filter((e): e is RegistryEntry => e.loadError === undefined);
  }

  getFailed(): FailedEntry[] {
    return this.entries.filter((e): e is FailedEntry => e.loadError !== undefined);
  }

  all(): AnyEntry[] {
    return [...this.entries];
  }
}

// ── Session-cached initialization ─────────────────────────────────────────

/** Cache key: resolved projectRoot canonical path. */
const registryCache = new Map<string, ScoutRegistry>();

/**
 * Build (or return cached) the scout registry for a project.
 *
 * Stage 1 only — imports and validates. Stage 2 probes happen on demand
 * (in /research:doctor --deep or before scout dispatch).
 *
 * Memoized by resolved projectRoot so multi-workspace pi sessions with
 * different projects don't share a registry.
 *
 * @param projectRoot  Absolute path to project root (used for trust classification)
 * @param config       Loaded project config (allowExternalScouts, scouts[])
 * @param builtinPaths Absolute .js paths for built-in scouts; loaded with builtin trust
 */
export async function ensureInitialized(
  projectRoot: string,
  config: DeepResearchConfig,
  builtinPaths: string[],
): Promise<ScoutRegistry> {
  let cacheKey: string;
  try {
    cacheKey = await realpath(projectRoot);
  } catch {
    cacheKey = projectRoot;
  }

  const cached = registryCache.get(cacheKey);
  if (cached) return cached;

  const registry = new ScoutRegistry();

  // Built-in scouts: always trusted (force allowExternalScouts true for this load)
  const builtinConfig: DeepResearchConfig = { ...config, allowExternalScouts: true };
  for (const builtinPath of builtinPaths) {
    const result = await loadScout(builtinPath, projectRoot, builtinConfig);
    if (result.ok) {
      registry.add({ scout: result.scout, trustSource: "builtin" });
    } else {
      registry.add({ id: result.id, loadError: result.error });
    }
  }

  // config.scouts[] entries
  const configScouts = Array.isArray(config.scouts) ? config.scouts : [];
  for (const entry of configScouts) {
    const spec: ScoutSpec =
      typeof entry === "string" ? { source: entry } : (entry as ScoutSpec);

    // Resolve relative paths against projectRoot
    const source = spec.source.startsWith("/") ? spec.source : join(projectRoot, spec.source);
    const result = await loadScout(source, projectRoot, config);
    if (result.ok) {
      registry.add({
        scout: result.scout,
        trustSource: result.trustSource,
        pluginConfig: spec.pluginConfig,
      });
    } else {
      registry.add({ id: spec.source, loadError: result.error });
    }
  }

  registryCache.set(cacheKey, registry);
  return registry;
}

/** Clear the registry cache. For testing and forced re-init after config changes. */
export function clearRegistryCache(): void {
  registryCache.clear();
}
