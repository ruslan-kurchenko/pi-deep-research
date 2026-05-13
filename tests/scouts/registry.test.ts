import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, afterEach } from "vitest";
import {
  clearRegistryCache,
  enforceTrustBoundary,
  loadScout,
  normalizeTrustSource,
  probeAvailability,
  ScoutRegistry,
} from "../../src/scouts/registry.js";
import type { ScoutDefinition } from "../../src/scouts/types.js";
import { SCOUT_API_VERSION } from "../../src/scouts/types.js";
import type { DeepResearchConfig } from "../../src/config/config.js";

afterEach(() => {
  clearRegistryCache();
});

// ── normalizeTrustSource ───────────────────────────────────────────────────

describe("normalizeTrustSource", () => {
  it("returns 'builtin' for paths inside the extension's own src/scouts/", () => {
    // The registry module lives at src/scouts/registry.ts, so paths under the
    // same directory are classified as builtin.
    const registryDir = new URL("../../src/scouts/", import.meta.url).pathname;
    const builtinPath = join(registryDir, "web.js");
    expect(normalizeTrustSource(builtinPath, "/tmp/project")).toBe("builtin");
  });

  it("returns 'project-local' for paths inside <projectRoot>/scouts/", () => {
    const projectRoot = "/tmp/my-project";
    const scoutPath = `${projectRoot}/scouts/my-scout.js`;
    expect(normalizeTrustSource(scoutPath, projectRoot)).toBe("project-local");
  });

  it("returns 'project-local' for paths inside <projectRoot>/examples/", () => {
    const projectRoot = "/tmp/my-project";
    const scoutPath = `${projectRoot}/examples/memory-mempalace/index.js`;
    expect(normalizeTrustSource(scoutPath, projectRoot)).toBe("project-local");
  });

  it("returns 'external' for paths outside project roots", () => {
    expect(
      normalizeTrustSource("/home/other-user/shared-scout.js", "/tmp/my-project"),
    ).toBe("external");
  });

  it("returns 'external' for absolute paths not under project or extension", () => {
    expect(normalizeTrustSource("/usr/local/lib/some-scout.js", "/home/project")).toBe("external");
  });
});

// ── enforceTrustBoundary ───────────────────────────────────────────────────

describe("enforceTrustBoundary", () => {
  const base: DeepResearchConfig = {};

  it("does not throw for builtin scouts regardless of allowExternalScouts", () => {
    expect(() =>
      enforceTrustBoundary("/extension/src/scouts/web.js", "builtin", base),
    ).not.toThrow();
  });

  it("does not throw for project-local scouts", () => {
    expect(() =>
      enforceTrustBoundary("/project/scouts/custom.js", "project-local", base),
    ).not.toThrow();
  });

  it("throws for external scouts when allowExternalScouts is not set", () => {
    expect(() =>
      enforceTrustBoundary("/home/other/evil.js", "external", base),
    ).toThrow("allowExternalScouts: true");
  });

  it("throws for external scouts when allowExternalScouts is explicitly false", () => {
    expect(() =>
      enforceTrustBoundary("/home/other/scout.js", "external", { allowExternalScouts: false }),
    ).toThrow("allowExternalScouts: true");
  });

  it("does NOT throw for external scouts when allowExternalScouts is true", () => {
    expect(() =>
      enforceTrustBoundary("/home/other/scout.js", "external", { allowExternalScouts: true }),
    ).not.toThrow();
  });

  it("trust-boundary error message includes the scout path and docs reference", () => {
    try {
      enforceTrustBoundary("/home/other/scout.js", "external", base);
      expect.fail("should have thrown");
    } catch (e) {
      const msg = String(e);
      expect(msg).toContain("/home/other/scout.js");
      expect(msg).toContain("docs/CUSTOM-SCOUTS.md");
    }
  });
});

// ── loadScout ─────────────────────────────────────────────────────────────

describe("loadScout", () => {
  let tmp: string;

  afterEach(async () => {
    if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => {});
  });

  it("returns error for .ts files (must be compiled first)", async () => {
    tmp = await mkdir(join(tmpdir(), "ls-ts-test"), { recursive: true }).then(() =>
      join(tmpdir(), "ls-ts-test"),
    );
    const tsPath = join(tmp, "scout.ts");
    await writeFile(tsPath, "export default {}");
    const result = await loadScout(tsPath, tmp, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Compile to .js first");
    }
  });

  it("returns error when path does not exist", async () => {
    const result = await loadScout("/nonexistent/path/scout.js", "/tmp", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Path not found");
    }
  });

  it("returns error for external scout when allowExternalScouts is false", async () => {
    // Create a minimal valid scout .js file in a temp dir (external to projectRoot)
    tmp = join(tmpdir(), `ext-scout-${Date.now()}`);
    await mkdir(tmp, { recursive: true });
    const scoutJs = join(tmp, "my-scout.js");
    await writeFile(
      scoutJs,
      `export default { scoutApiVersion: 1, id: "ext", label: "Ext", description: "External scout", ` +
        `mcpTools: [], cliBinaries: [], envVars: [], unavailableReason: "n/a", ` +
        `agentProfile: "/tmp/a.md", promptTemplate: "/tmp/p.md", promptVariables: [], ` +
        `defaultModel: "claude-haiku-4-5", agentName: "ext-scout", ` +
        `outputFilePattern: "ext-{n}.md", requiredOutputSections: [], ` +
        `isAvailable: async () => true };`,
    );
    // projectRoot is a different directory — so the scout is "external"
    const projectRoot = "/tmp/other-project";
    const result = await loadScout(scoutJs, projectRoot, { allowExternalScouts: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("allowExternalScouts");
    }
  });
});

// ── probeAvailability ─────────────────────────────────────────────────────

function makeScout(overrides: Partial<ScoutDefinition> = {}): ScoutDefinition {
  return {
    scoutApiVersion: SCOUT_API_VERSION,
    version: "1.0.0",
    id: "test",
    label: "Test",
    description: "Test scout",
    mcpTools: [],
    cliBinaries: [],
    envVars: [],
    unavailableReason: "not available",
    agentProfile: "/tmp/agent.md",
    promptTemplate: "/tmp/prompt.md",
    promptVariables: [],
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

describe("probeAvailability", () => {
  it("returns {available:true} when isAvailable() returns true", async () => {
    const scout = makeScout({ async isAvailable() { return true; } });
    const result = await probeAvailability(scout);
    expect(result.available).toBe(true);
  });

  it("returns {available:false, reason:'unavailable'} when isAvailable() returns false", async () => {
    const scout = makeScout({ async isAvailable() { return false; } });
    const result = await probeAvailability(scout);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toBe("unavailable");
  });

  it("returns {available:false, reason:'unavailable', detail} for structured negative", async () => {
    const scout = makeScout({
      async isAvailable() {
        return { available: false, reason: "MY_ENV_VAR not set" };
      },
    });
    const result = await probeAvailability(scout);
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe("unavailable");
      expect(result.detail).toBe("MY_ENV_VAR not set");
    }
  });

  it("returns {available:false, reason:'error', detail} when isAvailable() throws", async () => {
    const scout = makeScout({
      async isAvailable() {
        throw new Error("unexpected crash");
      },
    });
    const result = await probeAvailability(scout);
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe("error");
      expect(result.detail).toContain("unexpected crash");
    }
  });

  it("returns {available:false, reason:'timeout'} when probe hangs beyond timeoutMs", async () => {
    const scout = makeScout({
      timeoutMs: 50,
      async isAvailable() {
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms >> 50ms timeout
        return true;
      },
    });
    const result = await probeAvailability(scout);
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe("timeout");
      expect(result.detail).toContain("50ms");
    }
  });

  it("returns {available:true} for positive object shape", async () => {
    const scout = makeScout({ async isAvailable() { return { available: true }; } });
    const result = await probeAvailability(scout);
    expect(result.available).toBe(true);
  });
});

// ── ScoutRegistry ──────────────────────────────────────────────────────────

describe("ScoutRegistry", () => {
  const loaded = makeScout({ id: "loaded-scout" });

  it("getLoaded() returns only successfully loaded entries", () => {
    const reg = new ScoutRegistry();
    reg.add({ scout: loaded, trustSource: "builtin" });
    reg.add({ id: "failed", loadError: "import failed" });
    expect(reg.getLoaded()).toHaveLength(1);
    expect(reg.getLoaded()[0]?.scout.id).toBe("loaded-scout");
  });

  it("getFailed() returns only failed entries", () => {
    const reg = new ScoutRegistry();
    reg.add({ scout: loaded, trustSource: "project-local" });
    reg.add({ id: "bad1", loadError: "path not found" });
    reg.add({ id: "bad2", loadError: "ts file rejected" });
    expect(reg.getFailed()).toHaveLength(2);
    expect(reg.getFailed().map((e) => e.id)).toEqual(["bad1", "bad2"]);
  });

  it("all() returns every entry regardless of status", () => {
    const reg = new ScoutRegistry();
    reg.add({ scout: loaded, trustSource: "external" });
    reg.add({ id: "failed", loadError: "err" });
    expect(reg.all()).toHaveLength(2);
  });

  it("starts empty", () => {
    const reg = new ScoutRegistry();
    expect(reg.all()).toHaveLength(0);
    expect(reg.getLoaded()).toHaveLength(0);
    expect(reg.getFailed()).toHaveLength(0);
  });
});
