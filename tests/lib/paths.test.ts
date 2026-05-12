import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  nextIndex,
  researchDir,
  slugify,
  threadDir,
  threadId,
} from "../../src/lib/paths.js";

const TMP = join(import.meta.dirname, "../../.tmp-paths-test");

beforeEach(async () => {
  await mkdir(TMP, { recursive: true });
});

afterEach(async () => {
  await rm(TMP, { recursive: true, force: true });
});

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("VAPI vs Direct Twilio")).toBe("vapi-vs-direct-twilio");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("Node.js: perf (2026)!")).toBe("nodejs-perf-2026");
  });

  it("handles @scope/path references", () => {
    expect(slugify("Why do we need VAPI for @services/kai?")).toBe(
      "why-do-we-need-vapi-for-services-kai"
    );
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("bun  vs   node")).toBe("bun-vs-node");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello world--")).toBe("hello-world");
  });

  it("truncates to 60 chars", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
});

describe("researchDir", () => {
  it("returns <root>/research", () => {
    expect(researchDir("/my/project")).toBe("/my/project/research");
  });
});

describe("nextIndex", () => {
  it("returns 1 when research dir is empty", async () => {
    const dir = join(TMP, "research");
    await mkdir(dir, { recursive: true });
    expect(await nextIndex(TMP)).toBe(1);
  });

  it("returns 1 when research dir does not exist yet", async () => {
    expect(await nextIndex(TMP)).toBe(1);
  });

  it("returns max + 1 across existing thread dirs", async () => {
    const dir = join(TMP, "research");
    await mkdir(join(dir, "001-foo"), { recursive: true });
    await mkdir(join(dir, "003-bar"), { recursive: true }); // gap is fine
    expect(await nextIndex(TMP)).toBe(4);
  });

  it("ignores non-thread entries (files, misnamed dirs)", async () => {
    const dir = join(TMP, "research");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "README.md"), "");
    await mkdir(join(dir, "no-number-prefix"), { recursive: true });
    await mkdir(join(dir, "002-valid"), { recursive: true });
    expect(await nextIndex(TMP)).toBe(3);
  });
});

describe("threadId + threadDir", () => {
  it("zero-pads index to 3 digits", () => {
    expect(threadId(1, "my-topic")).toBe("001-my-topic");
    expect(threadId(42, "thing")).toBe("042-thing");
    expect(threadId(100, "x")).toBe("100-x");
  });

  it("threadDir joins root/research/id", () => {
    expect(threadDir("/root", "001-foo")).toBe("/root/research/001-foo");
  });
});
