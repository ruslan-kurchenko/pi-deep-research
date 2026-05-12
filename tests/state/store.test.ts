import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ResearchPhase } from "../../src/state/store.js";
import {
  clearActiveThread,
  createThread,
  getActiveThread,
  getThread,
  listThreads,
  setActiveThread,
  updateThreadPhase,
} from "../../src/state/store.js";

const TMP = join(import.meta.dirname, "../../.tmp-store-test");
const GLOBAL_STATE = join(TMP, "global-state");

beforeEach(async () => {
  await mkdir(TMP, { recursive: true });
  await mkdir(GLOBAL_STATE, { recursive: true });
});

afterEach(async () => {
  await rm(TMP, { recursive: true, force: true });
});

describe("createThread", () => {
  it("writes .state.json and returns the thread", async () => {
    const thread = await createThread(TMP, "001-test-topic", "test topic", ["architecture"]);
    expect(thread.id).toBe("001-test-topic");
    expect(thread.topic).toBe("test topic");
    expect(thread.scope).toEqual(["architecture"]);
    expect(thread.phase).toBe("brief");
  });

  it("round-trips through getThread", async () => {
    await createThread(TMP, "001-foo", "foo topic", ["nfr"]);
    const loaded = await getThread(TMP, "001-foo");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("001-foo");
    expect(loaded!.phase).toBe("brief");
  });
});

describe("updateThreadPhase", () => {
  it("persists the new phase", async () => {
    await createThread(TMP, "001-foo", "foo", ["feature"]);
    await updateThreadPhase(TMP, "001-foo", "scout");
    const loaded = await getThread(TMP, "001-foo");
    expect(loaded!.phase).toBe("scout");
  });
});

describe("listThreads", () => {
  it("returns empty array when no threads exist", async () => {
    expect(await listThreads(TMP)).toEqual([]);
  });

  it("returns all threads sorted by id", async () => {
    await createThread(TMP, "003-c", "c", ["architecture"]);
    await createThread(TMP, "001-a", "a", ["feature"]);
    await createThread(TMP, "002-b", "b", ["nfr"]);
    const all = await listThreads(TMP);
    expect(all.map((t) => t.id)).toEqual(["001-a", "002-b", "003-c"]);
  });
});

describe("active thread pointer", () => {
  it("starts null", async () => {
    expect(await getActiveThread(GLOBAL_STATE)).toBeNull();
  });

  it("set + get round-trips", async () => {
    await setActiveThread(GLOBAL_STATE, "001-foo");
    expect(await getActiveThread(GLOBAL_STATE)).toBe("001-foo");
  });

  it("clearActiveThread nullifies", async () => {
    await setActiveThread(GLOBAL_STATE, "001-foo");
    await clearActiveThread(GLOBAL_STATE);
    expect(await getActiveThread(GLOBAL_STATE)).toBeNull();
  });

  it("two threads in same project do not collide", async () => {
    await createThread(TMP, "001-a", "a", ["feature"]);
    await createThread(TMP, "002-b", "b", ["nfr"]);
    const a = await getThread(TMP, "001-a");
    const b = await getThread(TMP, "002-b");
    expect(a!.topic).toBe("a");
    expect(b!.topic).toBe("b");
  });
});

describe("phase type coverage", () => {
  it("all phases are assignable to ResearchPhase", () => {
    const phases: ResearchPhase[] = [
      "brief",
      "scout",
      "groom",
      "alternatives",
      "docs",
      "contract",
      "evaluate",
      "closed",
    ];
    expect(phases).toHaveLength(8);
  });
});
