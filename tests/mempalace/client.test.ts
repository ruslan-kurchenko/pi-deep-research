import { describe, expect, it, vi } from "vitest";
import { MemPalaceClient } from "../../src/mempalace/client.js";
import type { McpProxy } from "../../src/mempalace/client.js";

function makeMockProxy(response: unknown): McpProxy {
  return {
    call: vi.fn().mockResolvedValue(response),
  };
}

describe("MemPalaceClient.search", () => {
  it("calls mcp with mempalace_search tool and correct args", async () => {
    const proxy = makeMockProxy({ results: [{ content: "prior ADR", score: 0.9 }] });
    const client = new MemPalaceClient(proxy);

    const results = await client.search("voice agent architecture", "project-kai");

    expect(proxy.call).toHaveBeenCalledWith("mempalace_search", {
      query: "voice agent architecture",
      wing: "project-kai",
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe("prior ADR");
  });

  it("omits wing when not provided (global search)", async () => {
    const proxy = makeMockProxy({ results: [] });
    const client = new MemPalaceClient(proxy);

    await client.search("stack preferences");

    expect(proxy.call).toHaveBeenCalledWith("mempalace_search", {
      query: "stack preferences",
    });
  });

  it("returns empty array when results missing", async () => {
    const proxy = makeMockProxy({});
    const client = new MemPalaceClient(proxy);
    expect(await client.search("anything")).toEqual([]);
  });
});

describe("MemPalaceClient.addDrawer", () => {
  it("calls mcp with mempalace_add_drawer tool", async () => {
    const proxy = makeMockProxy({ ok: true });
    const client = new MemPalaceClient(proxy);

    await client.addDrawer({
      wing: "project-kai",
      room: "Research",
      title: "Voice Stack ADR",
      content: "# Decision\n...",
      tags: ["voice", "architecture"],
    });

    expect(proxy.call).toHaveBeenCalledWith("mempalace_add_drawer", {
      wing: "project-kai",
      room: "Research",
      title: "Voice Stack ADR",
      content: "# Decision\n...",
      tags: ["voice", "architecture"],
    });
  });
});

describe("MemPalaceClient.status", () => {
  it("calls mcp with mempalace_status tool", async () => {
    const proxy = makeMockProxy({ wings: ["PAI-Global", "project-kai"] });
    const client = new MemPalaceClient(proxy);

    const result = await client.status();
    expect(proxy.call).toHaveBeenCalledWith("mempalace_status", {});
    expect(result).toEqual({ wings: ["PAI-Global", "project-kai"] });
  });
});
