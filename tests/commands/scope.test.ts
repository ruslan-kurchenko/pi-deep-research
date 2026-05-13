import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { createThread } from "../../src/state/store.js";

/**
 * Bug F: scope was stored via ctx.ui.select() (single-select) but typed as
 * string[] and labelled "select all that apply". The fix:
 *   - Label changed to "Research scope (primary):" (no misleading multi-select claim)
 *   - Result still wrapped in [scope] → string[] in createThread
 *
 * This test verifies the storage contract: scope is always a string array.
 */
describe("scope storage [bug-F]", () => {
  it("[bug-F] scope is stored as string[] in thread state (never a bare string)", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-bug-f-"));
    try {
      const thread = await createThread(tmp, "001-test", "test topic", ["architecture"]);
      expect(Array.isArray(thread.scope)).toBe(true);
      expect(thread.scope).toEqual(["architecture"]);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("[bug-F] multi-scope is preserved when passed as array", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-bug-f-"));
    try {
      const thread = await createThread(tmp, "001-test", "test topic", [
        "architecture",
        "feature",
      ]);
      expect(thread.scope).toEqual(["architecture", "feature"]);
      expect(thread.scope.length).toBe(2);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("[bug-F] scope label in new.ts no longer says 'select all that apply'", async () => {
    // Guard against regression: the misleading label must not reappear
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../../src/commands/new.ts", import.meta.url).pathname,
      "utf8"
    );
    expect(src).not.toContain("select all that apply");
  });
});
