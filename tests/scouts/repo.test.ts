import { describe, expect, it } from "vitest";
import { buildRepoScoutSpec } from "../../src/scouts/repo.js";

describe("buildRepoScoutSpec", () => {
  it("[bug-B] includes relevantPaths in prompt when provided", async () => {
    const spec = await buildRepoScoutSpec(
      "/tmp/thread",
      "test brief",
      "/project",
      ["src/commands", "src/scouts"],
      1,
      "claude-haiku-4-5"
    );
    expect(spec.prompt).toContain("src/commands");
    expect(spec.prompt).toContain("src/scouts");
  });

  it("[bug-B] uses broad scan message when no paths given", async () => {
    const spec = await buildRepoScoutSpec(
      "/tmp/thread",
      "test brief",
      "/project",
      [],
      1,
      "claude-haiku-4-5"
    );
    expect(spec.prompt).toContain("_Not specified");
  });

  it("sets correct agentName and label", async () => {
    const spec = await buildRepoScoutSpec(
      "/tmp/thread",
      "test brief",
      "/project",
      [],
      1,
      "claude-haiku-4-5"
    );
    expect(spec.agentName).toBe("research-repo-scout");
    expect(spec.label).toBe("repo");
  });
});
