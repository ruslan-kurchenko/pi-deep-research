import { describe, expect, it } from "vitest";
import type { ResearchPhase } from "../../src/state/store.js";
import { canAdvanceTo, nextPhase, PHASE_ORDER } from "../../src/state/tracker.js";

describe("PHASE_ORDER", () => {
  it("has 8 phases in correct sequence", () => {
    expect(PHASE_ORDER).toEqual([
      "brief",
      "scout",
      "groom",
      "alternatives",
      "docs",
      "contract",
      "evaluate",
      "closed",
    ]);
  });
});

describe("canAdvanceTo", () => {
  it("allows advancing to the next phase", () => {
    expect(canAdvanceTo("brief", "scout")).toBe(true);
    expect(canAdvanceTo("scout", "groom")).toBe(true);
    expect(canAdvanceTo("groom", "alternatives")).toBe(true);
  });

  it("allows skipping phases forward (e.g. brief → docs)", () => {
    expect(canAdvanceTo("brief", "docs")).toBe(true);
  });

  it("forbids going backwards", () => {
    expect(canAdvanceTo("scout", "brief")).toBe(false);
    expect(canAdvanceTo("docs", "groom")).toBe(false);
  });

  it("forbids staying on the same phase", () => {
    expect(canAdvanceTo("scout", "scout")).toBe(false);
  });

  it("closed can never advance further", () => {
    expect(canAdvanceTo("closed", "closed")).toBe(false);
  });
});

describe("nextPhase", () => {
  it("returns the immediate next phase", () => {
    const cases: Array<[ResearchPhase, ResearchPhase]> = [
      ["brief", "scout"],
      ["scout", "groom"],
      ["groom", "alternatives"],
      ["alternatives", "docs"],
      ["docs", "contract"],
      ["contract", "evaluate"],
      ["evaluate", "closed"],
    ];
    for (const [from, expected] of cases) {
      expect(nextPhase(from)).toBe(expected);
    }
  });

  it("returns null for closed", () => {
    expect(nextPhase("closed")).toBeNull();
  });
});
