import { describe, expect, it } from "vitest";
import { buildEvaluateInstruction } from "../../src/docs/instructions.js";

const BASE_ARGS = [
  "001-test",
  "/path/contract.md",
  "## Contract",
  "/path/output.md",
  "2026-05-13",
  "manual",
  "/project",
] as const;

describe("buildEvaluateInstruction", () => {
  it("[bug-I] omits mempalace_add_drawer when mempalaceUrl is absent (undefined)", () => {
    const result = buildEvaluateInstruction(...BASE_ARGS, undefined);
    expect(result).not.toMatch(/mempalace_add_drawer/);
    expect(result).toContain("MemPalace is not configured");
    expect(result).toContain("Skip this step");
  });

  it("[bug-I] includes mempalace_add_drawer when mempalaceUrl is set", () => {
    const result = buildEvaluateInstruction(...BASE_ARGS, "https://mp.example.com");
    expect(result).toContain("mempalace_add_drawer");
    expect(result).not.toContain("MemPalace is not configured");
  });

  it("[bug-I] backward compat: 7-arg call omits mempalace step", () => {
    const result = buildEvaluateInstruction(...BASE_ARGS);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toMatch(/mempalace_add_drawer/);
  });

  it("[bug-I] uses projectRoot to derive wing name for mempalace step", () => {
    const result = buildEvaluateInstruction(
      "001-test",
      "/path/contract.md",
      "## Contract",
      "/path/output.md",
      "2026-05-13",
      "manual",
      "/home/user/my-project",
      "https://mp.example.com"
    );
    expect(result).toContain("project-my-project");
  });

  it("includes thread ID in output path and heading", () => {
    const result = buildEvaluateInstruction(...BASE_ARGS, "https://mp.example.com");
    expect(result).toContain("001-test");
    expect(result).toContain("/path/output.md");
  });
});
