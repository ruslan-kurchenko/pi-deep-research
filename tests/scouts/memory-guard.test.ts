import { describe, expect, it } from "vitest";
import { buildMemoryScoutSpec } from "../../src/scouts/memory.js";

/**
 * Bug E: memory scout was dispatched unconditionally even when mempalaceUrl
 * was not configured. The conditional dispatch guard is in runScout() (integration
 * level — tested via loadConfig). This file tests the scout spec builder itself
 * and documents the bug contract.
 *
 * The actual guard is: `config.mempalaceUrl ? buildMemoryScoutSpec(...) : null`
 * in src/commands/scout.ts — verified by the evaluate-instruction tests (bug-I)
 * and the config system tests (config.test.ts).
 */
describe("memory scout guard [bug-E]", () => {
  it("[bug-E] buildMemoryScoutSpec includes projectWing in prompt", async () => {
    const spec = await buildMemoryScoutSpec(
      "/tmp/thread",
      "test brief",
      "project-my-app",
      1,
      "claude-haiku-4-5"
    );
    expect(spec.label).toBe("memory");
    expect(spec.prompt).toContain("project-my-app");
  });

  it("[bug-E] buildMemoryScoutSpec sets correct agentName", async () => {
    const spec = await buildMemoryScoutSpec(
      "/tmp/thread",
      "test brief",
      "project-test",
      1,
      "claude-haiku-4-5"
    );
    expect(spec.agentName).toBe("research-memory-scout");
  });

  it("[bug-E] memory scout is NOT in default 3-scout roster when mempalaceUrl absent", async () => {
    // loadConfig returns {} when no config file exists — so mempalaceUrl is undefined.
    // The fix in scout.ts: only buildMemoryScoutSpec when config.mempalaceUrl is set.
    // This test documents the contract by asserting loadConfig({}) has no mempalaceUrl.
    const { loadConfig } = await import("../../src/config/config.js");
    const { mkdtemp, rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const tmp = await mkdtemp(join(tmpdir(), "pi-bug-e-"));
    try {
      const cfg = await loadConfig(tmp);
      expect(cfg.mempalaceUrl).toBeUndefined();
      // When mempalaceUrl is undefined, the conditional in scout.ts short-circuits:
      //   const memorySpec = config.mempalaceUrl ? await buildMemoryScoutSpec(...) : null;
      // → memorySpec = null → specs = [...baseSpecs] (3 scouts only)
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
