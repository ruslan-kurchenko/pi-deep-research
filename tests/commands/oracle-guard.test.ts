import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";

describe("[bug-D] oracle file-existence guard", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "pi-oracle-"));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("[bug-D] errors when linked doc path is in state but file does not exist on disk", async () => {
    const threadId = "001-test-oracle";
    const threadDirPath = join(tmp, "research", threadId);
    await mkdir(threadDirPath, { recursive: true });

    const nonExistentDoc = join(tmp, "docs", "design", "missing.md");
    const state = {
      id: threadId,
      topic: "test",
      scope: ["architecture"],
      phase: "docs",
      createdAt: new Date().toISOString(),
      linkedDocs: { designDoc: nonExistentDoc },
      modelUsage: [],
      modelFallbacks: {},
      oracleReviews: [],
    };
    await writeFile(join(threadDirPath, ".state.json"), JSON.stringify(state));

    const notifyFn = vi.fn();
    const sendMessageFn = vi.fn();
    const mockCtx = {
      ui: { notify: notifyFn, confirm: vi.fn().mockResolvedValue(false), select: vi.fn() },
      cwd: tmp,
    };
    const mockPi = { sendUserMessage: sendMessageFn };

    const { runOracle } = await import("../../src/commands/oracle.js");
    await runOracle("after-doc", mockCtx as any, mockPi as any, tmp, threadId);

    expect(notifyFn).toHaveBeenCalledWith(
      expect.stringContaining("not found on disk"),
      "error"
    );
    expect(sendMessageFn).not.toHaveBeenCalled();
  });

  it("[bug-D] passes the disk check when linked doc exists on disk", async () => {
    const threadId = "001-test-oracle-exists";
    const threadDirPath = join(tmp, "research", threadId);
    await mkdir(threadDirPath, { recursive: true });

    const docDir = join(tmp, "docs", "design");
    await mkdir(docDir, { recursive: true });
    const docPath = join(docDir, "present.md");
    await writeFile(docPath, "# Real design doc\n\nSome content here.");

    const state = {
      id: threadId,
      topic: "test",
      scope: ["architecture"],
      phase: "docs",
      createdAt: new Date().toISOString(),
      linkedDocs: { designDoc: docPath },
      modelUsage: [],
      modelFallbacks: {},
      oracleReviews: [],
    };
    await writeFile(join(threadDirPath, ".state.json"), JSON.stringify(state));

    const notifyFn = vi.fn();
    const sendMessageFn = vi.fn();
    const mockCtx = {
      ui: { notify: notifyFn, confirm: vi.fn().mockResolvedValue(false), select: vi.fn() },
      cwd: tmp,
    };
    const mockPi = { sendUserMessage: sendMessageFn };

    const { runOracle } = await import("../../src/commands/oracle.js");
    // runOracle will fail later (no real provider), but must NOT fail with "not found on disk"
    await runOracle("after-doc", mockCtx as any, mockPi as any, tmp, threadId).catch(() => {});

    // The disk-check guard must not have fired
    const diskErrors = notifyFn.mock.calls.filter(
      ([msg, level]) => typeof msg === "string" && msg.includes("not found on disk") && level === "error"
    );
    expect(diskErrors).toHaveLength(0);
  });
});
