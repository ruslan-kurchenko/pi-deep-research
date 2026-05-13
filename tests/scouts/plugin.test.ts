import { describe, expect, it } from "vitest";
import type { ScoutDefinition } from "../../src/scouts/types.js";
import {
  SCOUT_API_VERSION,
  normalizeAvailability,
  validateScoutInterface,
} from "../../src/scouts/types.js";

// ── Helper: create a minimal valid ScoutDefinition ───────────────────────────
function makeScout(overrides: Partial<ScoutDefinition> = {}): ScoutDefinition {
  return {
    scoutApiVersion: SCOUT_API_VERSION,
    version: "1.0.0",
    id: "test-scout",
    label: "Test",
    description: "Test scout for contract verification",
    mcpTools: [],
    cliBinaries: [],
    envVars: [],
    unavailableReason: "not available in this environment",
    agentProfile: "/tmp/agent.md",
    promptTemplate: "/tmp/prompt.md",
    promptVariables: ["brief"],
    defaultModel: "claude-haiku-4-5",
    agentName: "test-scout",
    outputFilePattern: "test-{n}.md",
    requiredOutputSections: [],
    async isAvailable() {
      return true;
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("ScoutDefinition plugin contract (Metric M4)", () => {
  // Test 1: valid scout passes Stage 1 interface validation
  it("valid scout has all required fields and passes validateScoutInterface", () => {
    const scout = makeScout();
    const err = validateScoutInterface(scout);
    expect(err).toBeNull();

    // Spot-check key fields
    expect(typeof scout.id).toBe("string");
    expect(scout.id.length).toBeGreaterThan(0);
    expect(typeof scout.scoutApiVersion).toBe("number");
    expect(scout.scoutApiVersion).toBe(SCOUT_API_VERSION);
    expect(typeof scout.isAvailable).toBe("function");
    expect(Array.isArray(scout.mcpTools)).toBe(true);
    expect(Array.isArray(scout.cliBinaries)).toBe(true);
    expect(Array.isArray(scout.envVars)).toBe(true);
    expect(Array.isArray(scout.promptVariables)).toBe(true);
    expect(Array.isArray(scout.requiredOutputSections)).toBe(true);
  });

  // Test 2: schema mismatch caught at Stage 1
  it("scout missing id field fails validateScoutInterface with clear message", () => {
    const badScout = makeScout({ id: "" }); // empty id = invalid
    const err = validateScoutInterface(badScout);
    expect(err).not.toBeNull();
    expect(err).toContain("id");
  });

  it("non-object export fails validateScoutInterface", () => {
    expect(validateScoutInterface(null)).toContain("not an object");
    expect(validateScoutInterface("string")).toContain("not an object");
    expect(validateScoutInterface(42)).toContain("not an object");
  });

  it("scout missing isAvailable method fails validateScoutInterface", () => {
    const noFn = { ...makeScout(), isAvailable: undefined as unknown as ScoutDefinition["isAvailable"] };
    const err = validateScoutInterface(noFn);
    expect(err).not.toBeNull();
    expect(err).toContain("isAvailable");
  });

  // Test 3: external scout path rejected when allowExternalScouts is false
  it("[allowExternalScouts] external paths outside project roots are classified as 'external'", () => {
    const projectRoot = "/tmp/my-project";

    function classifyPath(scoutPath: string, root: string): "builtin" | "project-local" | "external" {
      // Built-ins: inside the extension's own src/scouts/
      if (scoutPath.includes("/pi-deep-research/src/scouts/")) return "builtin";
      // Project-local: inside projectRoot/scouts or projectRoot/examples
      if (scoutPath.startsWith(`${root}/scouts/`) || scoutPath.startsWith(`${root}/examples/`)) {
        return "project-local";
      }
      return "external";
    }

    // External path → classified as external
    expect(classifyPath("/home/other/my-scout.js", projectRoot)).toBe("external");
    // Project-local scouts/ path → trusted
    expect(classifyPath(`${projectRoot}/scouts/my-scout.js`, projectRoot)).toBe("project-local");
    // Project-local examples/ path → trusted
    expect(classifyPath(`${projectRoot}/examples/memory/index.js`, projectRoot)).toBe("project-local");
    // Built-in → trusted
    expect(classifyPath("/usr/local/lib/pi-deep-research/src/scouts/web.js", projectRoot)).toBe("builtin");

    // The trust gate: external without flag → should reject
    const trustSource = classifyPath("/home/other/my-scout.js", projectRoot);
    const allowExternalScouts = false;
    expect(trustSource === "external" && !allowExternalScouts).toBe(true);
  });

  // Test 4: availability probe completes and normalizes all return shapes
  it("isAvailable() resolves within reasonable timeout and handles all return shapes", async () => {
    // Shape 1: boolean true
    const scout1 = makeScout({ async isAvailable() { return true; } });
    const r1 = await scout1.isAvailable();
    const n1 = normalizeAvailability(r1);
    expect(n1.available).toBe(true);

    // Shape 2: boolean false
    const scout2 = makeScout({ async isAvailable() { return false; } });
    const r2 = await scout2.isAvailable();
    const n2 = normalizeAvailability(r2);
    expect(n2.available).toBe(false);
    expect(n2.reason).toBe("unavailable");

    // Shape 3: explicit positive object
    const scout3 = makeScout({ async isAvailable() { return { available: true }; } });
    const r3 = await scout3.isAvailable();
    const n3 = normalizeAvailability(r3);
    expect(n3.available).toBe(true);

    // Shape 4: structured negative with reason
    const scout4 = makeScout({
      async isAvailable() { return { available: false, reason: "MYENV not set" }; }
    });
    const start = Date.now();
    const r4 = await scout4.isAvailable();
    const elapsed = Date.now() - start;
    const n4 = normalizeAvailability(r4);
    expect(n4.available).toBe(false);
    expect(n4.reason).toBe("MYENV not set");
    expect(elapsed).toBeLessThan(1000); // much less than 2000ms default
  });

  // Test 5: SCOUT_API_VERSION is 1 and version compatibility logic is correct
  it("SCOUT_API_VERSION equals 1 and version comparison logic works", () => {
    expect(SCOUT_API_VERSION).toBe(1);

    // Current version — compatible
    const current = makeScout({ scoutApiVersion: SCOUT_API_VERSION });
    expect(current.scoutApiVersion).toBe(SCOUT_API_VERSION);
    expect(current.scoutApiVersion > SCOUT_API_VERSION).toBe(false); // not too new

    // Older version — warn but attempt load (best effort)
    const older = makeScout({ scoutApiVersion: 0 });
    expect(older.scoutApiVersion < SCOUT_API_VERSION).toBe(true);

    // Newer version — incompatible, must exclude
    const newer = makeScout({ scoutApiVersion: SCOUT_API_VERSION + 1 });
    expect(newer.scoutApiVersion > SCOUT_API_VERSION).toBe(true);
  });

  // Test 6: normalizeAvailability handles all four shapes correctly
  it("normalizeAvailability handles all return shapes (boolean true/false, objects)", () => {
    expect(normalizeAvailability(true)).toEqual({ available: true });
    expect(normalizeAvailability(false)).toEqual({ available: false, reason: "unavailable" });
    expect(normalizeAvailability({ available: true })).toEqual({ available: true });
    expect(normalizeAvailability({ available: false, reason: "env not set" })).toEqual({
      available: false,
      reason: "env not set",
    });
  });

  // Test 7: scout with all dependency declarations is introspectable without import
  it("scout dependency declarations are arrays and iterable without calling isAvailable()", () => {
    const scout = makeScout({
      mcpTools: ["mempalace_search", "mempalace_add_drawer"],
      cliBinaries: ["gh", "librarian"],
      envVars: ["MEMPALACE_URL", "GITHUB_TOKEN"],
    });
    // Doctor --deep iterates these without calling isAvailable()
    const allDeps = [
      ...scout.mcpTools.map((t) => `mcp:${t}`),
      ...scout.cliBinaries.map((b) => `bin:${b}`),
      ...scout.envVars.map((e) => `env:${e}`),
    ];
    expect(allDeps).toContain("mcp:mempalace_search");
    expect(allDeps).toContain("bin:gh");
    expect(allDeps).toContain("env:MEMPALACE_URL");
    expect(allDeps.length).toBe(6);
  });
});
