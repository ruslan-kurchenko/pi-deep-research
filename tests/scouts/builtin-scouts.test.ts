import { describe, expect, it } from "vitest";
import webScout from "../../src/scouts/web/index.js";
import ossScout from "../../src/scouts/oss/index.js";
import repoScout from "../../src/scouts/repo/index.js";
import { SCOUT_API_VERSION } from "../../src/scouts/types.js";

const BUILTIN_SCOUTS = [webScout, ossScout, repoScout];

describe("Built-in ScoutDefinition modules", () => {
  for (const scout of BUILTIN_SCOUTS) {
    describe(`${scout.id} scout`, () => {
      it("has correct scoutApiVersion", () => {
        expect(scout.scoutApiVersion).toBe(SCOUT_API_VERSION);
        expect(scout.scoutApiVersion).toBe(1);
      });

      it("has required string fields", () => {
        expect(typeof scout.id).toBe("string");
        expect(scout.id.length).toBeGreaterThan(0);
        expect(typeof scout.label).toBe("string");
        expect(typeof scout.description).toBe("string");
        expect(typeof scout.defaultModel).toBe("string");
        expect(typeof scout.agentName).toBe("string");
        expect(typeof scout.version).toBe("string");
        expect(typeof scout.unavailableReason).toBe("string");
      });

      it("has array fields", () => {
        expect(Array.isArray(scout.mcpTools)).toBe(true);
        expect(Array.isArray(scout.cliBinaries)).toBe(true);
        expect(Array.isArray(scout.envVars)).toBe(true);
        expect(Array.isArray(scout.promptVariables)).toBe(true);
        expect(Array.isArray(scout.requiredOutputSections)).toBe(true);
      });

      it("isAvailable is a function", () => {
        expect(typeof scout.isAvailable).toBe("function");
      });

      it("agentProfile and promptTemplate are absolute paths", () => {
        expect(scout.agentProfile).toMatch(/^\//);
        expect(scout.promptTemplate).toMatch(/^\//);
      });

      it("outputFilePattern contains {n} token", () => {
        expect(scout.outputFilePattern).toContain("{n}");
      });

      it("defaultModel is a native pi model ID (no slash)", () => {
        expect(scout.defaultModel).not.toContain("/");
      });
    });
  }

  it("all built-in scouts have unique ids", () => {
    const ids = BUILTIN_SCOUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("built-in scout ids match expected names", () => {
    const ids = BUILTIN_SCOUTS.map((s) => s.id);
    expect(ids).toContain("web");
    expect(ids).toContain("oss");
    expect(ids).toContain("repo");
  });
});

describe("web scout specifics", () => {
  it("isAvailable returns true (always available)", async () => {
    const result = await webScout.isAvailable();
    expect(result).toBe(true);
  });

  it("uses correct agent and template names", () => {
    expect(webScout.agentName).toBe("research-web-scout");
    expect(webScout.promptTemplate).toContain("scout-web.md");
  });
});

describe("oss scout specifics", () => {
  it("declares gh as required binary", () => {
    expect(ossScout.cliBinaries).toContain("gh");
  });

  it("declares librarian as required MCP tool", () => {
    expect(ossScout.mcpTools).toContain("librarian");
  });
});

describe("repo scout specifics", () => {
  it("isAvailable returns true", async () => {
    const result = await repoScout.isAvailable();
    expect(result).toBe(true);
  });

  it("promptVariables includes project_root", () => {
    expect(repoScout.promptVariables).toContain("project_root");
  });
});

describe("memory-mempalace example scout", () => {
  it("[bug-E] isAvailable returns false-like result when MEMPALACE_URL not set", async () => {
    const { default: memScout } = await import(
      "../../examples/memory-mempalace/index.js"
    );
    const origUrl = process.env["MEMPALACE_URL"];
    delete process.env["MEMPALACE_URL"];
    try {
      const result = await memScout.isAvailable();
      if (typeof result === "boolean") {
        expect(result).toBe(false);
      } else {
        expect((result as { available: boolean }).available).toBe(false);
      }
    } finally {
      if (origUrl !== undefined) process.env["MEMPALACE_URL"] = origUrl;
    }
  });

  it("[bug-E] isAvailable returns true when MEMPALACE_URL is set", async () => {
    const { default: memScout } = await import(
      "../../examples/memory-mempalace/index.js"
    );
    const origUrl = process.env["MEMPALACE_URL"];
    process.env["MEMPALACE_URL"] = "https://example.com";
    try {
      const result = await memScout.isAvailable();
      if (typeof result === "boolean") {
        expect(result).toBe(true);
      } else {
        expect((result as { available: boolean }).available).toBe(true);
      }
    } finally {
      if (origUrl !== undefined) {
        process.env["MEMPALACE_URL"] = origUrl;
      } else {
        delete process.env["MEMPALACE_URL"];
      }
    }
  });

  it("[bug-E] isAvailable accepts mempalaceUrl from config slice", async () => {
    const { default: memScout } = await import(
      "../../examples/memory-mempalace/index.js"
    );
    const origUrl = process.env["MEMPALACE_URL"];
    delete process.env["MEMPALACE_URL"];
    try {
      const result = await memScout.isAvailable({ mempalaceUrl: "https://example.com" });
      if (typeof result === "boolean") {
        expect(result).toBe(true);
      } else {
        expect((result as { available: boolean }).available).toBe(true);
      }
    } finally {
      if (origUrl !== undefined) process.env["MEMPALACE_URL"] = origUrl;
    }
  });

  it("has correct scoutApiVersion", async () => {
    const { default: memScout } = await import(
      "../../examples/memory-mempalace/index.js"
    );
    expect(memScout.scoutApiVersion).toBe(SCOUT_API_VERSION);
  });

  it("id is memory-mempalace", async () => {
    const { default: memScout } = await import(
      "../../examples/memory-mempalace/index.js"
    );
    expect(memScout.id).toBe("memory-mempalace");
  });

  it("onUnavailable is skip", async () => {
    const { default: memScout } = await import(
      "../../examples/memory-mempalace/index.js"
    );
    expect(memScout.onUnavailable).toBe("skip");
  });
});

describe("github-trends example scout", () => {
  it("has correct scoutApiVersion", async () => {
    const { default: scout } = await import(
      "../../examples/github-trends/index.js"
    );
    expect(scout.scoutApiVersion).toBe(SCOUT_API_VERSION);
  });

  it("id is github-trends", async () => {
    const { default: scout } = await import("../../examples/github-trends/index.js");
    expect(scout.id).toBe("github-trends");
  });

  it("declares gh as required binary", async () => {
    const { default: scout } = await import("../../examples/github-trends/index.js");
    expect(scout.cliBinaries).toContain("gh");
  });

  it("requires no env vars", async () => {
    const { default: scout } = await import("../../examples/github-trends/index.js");
    expect(scout.envVars).toHaveLength(0);
  });

  it("agentProfile and promptTemplate are absolute paths", async () => {
    const { default: scout } = await import("../../examples/github-trends/index.js");
    expect(scout.agentProfile).toMatch(/^\//);
    expect(scout.promptTemplate).toMatch(/^\//);
  });
});
