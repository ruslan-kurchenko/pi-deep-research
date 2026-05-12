import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  aggregateFiles,
  readMarkdownDir,
  readOptional,
  readRawScouts,
} from "../../src/lib/files.js";

const TMP = join(import.meta.dirname, "../../.tmp-files-test");

beforeEach(() => mkdir(TMP, { recursive: true }));
afterEach(() => rm(TMP, { recursive: true, force: true }));

describe("readOptional", () => {
  it("returns content for existing file", async () => {
    await writeFile(join(TMP, "test.md"), "hello");
    expect(await readOptional(join(TMP, "test.md"))).toBe("hello");
  });
  it("returns null for missing file", async () => {
    expect(await readOptional(join(TMP, "nope.md"))).toBeNull();
  });
});

describe("readMarkdownDir", () => {
  it("returns empty map for missing dir", async () => {
    const m = await readMarkdownDir(join(TMP, "nonexistent"));
    expect(m.size).toBe(0);
  });

  it("reads only .md files, sorted", async () => {
    await writeFile(join(TMP, "b.md"), "B");
    await writeFile(join(TMP, "a.md"), "A");
    await writeFile(join(TMP, "skip.txt"), "ignored");
    const m = await readMarkdownDir(TMP);
    expect([...m.keys()]).toEqual(["a.md", "b.md"]);
    expect(m.get("a.md")).toBe("A");
  });
});

describe("aggregateFiles", () => {
  it("returns placeholder for empty map", () => {
    expect(aggregateFiles(new Map())).toBe("_No files found._");
  });

  it("wraps each file with a header", () => {
    const m = new Map([["web-001-web.md", "## Findings\nfoo"]]);
    const result = aggregateFiles(m);
    expect(result).toContain("### web-001-web.md");
    expect(result).toContain("## Findings\nfoo");
  });

  it("separates multiple files with a divider", () => {
    const m = new Map([
      ["a.md", "AAA"],
      ["b.md", "BBB"],
    ]);
    expect(aggregateFiles(m)).toContain("---");
  });
});

describe("readRawScouts", () => {
  it("reads raw/ subdirectory", async () => {
    const raw = join(TMP, "raw");
    await mkdir(raw);
    await writeFile(join(raw, "web-001-web.md"), "## Findings\nweb stuff");
    const result = await readRawScouts(TMP);
    expect(result).toContain("web-001-web.md");
    expect(result).toContain("web stuff");
  });

  it("returns placeholder when raw/ is empty", async () => {
    await mkdir(join(TMP, "raw"));
    expect(await readRawScouts(TMP)).toBe("_No files found._");
  });
});
