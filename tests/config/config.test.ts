import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/config.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";

describe("loadConfig", () => {
  it("returns empty object when config file does not exist", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-cfg-"));
    try {
      expect(await loadConfig(tmp)).toEqual({});
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("parses a valid config with mempalaceUrl and user", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-cfg-"));
    try {
      await mkdir(join(tmp, ".pi", "deep-research"), { recursive: true });
      await writeFile(
        join(tmp, ".pi", "deep-research", "config.json"),
        JSON.stringify({ mempalaceUrl: "https://mp.example.com", user: { name: "Alice" } })
      );
      const cfg = await loadConfig(tmp);
      expect(cfg.mempalaceUrl).toBe("https://mp.example.com");
      expect(cfg.user?.name).toBe("Alice");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns empty object on malformed JSON", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-cfg-"));
    try {
      await mkdir(join(tmp, ".pi", "deep-research"), { recursive: true });
      await writeFile(join(tmp, ".pi", "deep-research", "config.json"), "{ broken");
      expect(await loadConfig(tmp)).toEqual({});
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns empty object when config has no mempalaceUrl", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-cfg-"));
    try {
      await mkdir(join(tmp, ".pi", "deep-research"), { recursive: true });
      await writeFile(
        join(tmp, ".pi", "deep-research", "config.json"),
        JSON.stringify({ user: { name: "Bob" } })
      );
      const cfg = await loadConfig(tmp);
      expect(cfg.mempalaceUrl).toBeUndefined();
      expect(cfg.user?.name).toBe("Bob");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
