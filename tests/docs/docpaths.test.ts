import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { docDir, docOutputPath, nextDocNumber } from "../../src/docs/docpaths.js";

const TMP = join(import.meta.dirname, "../../.tmp-docpaths-test");

beforeEach(() => mkdir(TMP, { recursive: true }));
afterEach(() => rm(TMP, { recursive: true, force: true }));

describe("nextDocNumber", () => {
  it("returns 1 when no doc dirs exist", async () => {
    expect(await nextDocNumber(TMP)).toBe(1);
  });

  it("returns max+1 across all doc types", async () => {
    await mkdir(join(TMP, "docs/decisions/adrs"), { recursive: true });
    await mkdir(join(TMP, "docs/rfcs"), { recursive: true });
    await writeFile(join(TMP, "docs/decisions/adrs", "002-some-adr.md"), "");
    await writeFile(join(TMP, "docs/rfcs", "005-some-rfc.md"), "");
    expect(await nextDocNumber(TMP)).toBe(6);
  });

  it("ignores non-NNN-prefixed files", async () => {
    await mkdir(join(TMP, "docs/prds"), { recursive: true });
    await writeFile(join(TMP, "docs/prds", "README.md"), "");
    expect(await nextDocNumber(TMP)).toBe(1);
  });
});

describe("docOutputPath", () => {
  it("composes path with zero-padded number", () => {
    const p = docOutputPath(TMP, "adr", 3, "remove-vapi");
    expect(p).toContain("docs/decisions/adrs");
    expect(p).toContain("003-remove-vapi.md");
  });

  it("handles all doc types without throwing", () => {
    const types = ["adr", "rfc", "design-doc", "prd", "measurement", "evaluation"] as const;
    for (const t of types) {
      expect(() => docOutputPath(TMP, t, 1, "test")).not.toThrow();
    }
  });
});

describe("docDir", () => {
  it("adrs go in docs/decisions/adrs", () => {
    expect(docDir(TMP, "adr")).toContain("docs/decisions/adrs");
  });
  it("rfcs go in docs/rfcs", () => {
    expect(docDir(TMP, "rfc")).toContain("docs/rfcs");
  });
});
