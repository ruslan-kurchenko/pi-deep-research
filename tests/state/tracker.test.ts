import { describe, expect, it } from "vitest";
import type { ResearchPhase, ResearchThread } from "../../src/state/store.js";
import { canAdvanceTo, canRunCommand, nextPhase, PHASE_ORDER } from "../../src/state/tracker.js";

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

// ── canRunCommand [bug-A] ────────────────────────────────────────────────────

function makeThread(
  phase: ResearchPhase,
  overrides: Partial<ResearchThread> = {}
): ResearchThread {
  return {
    id: "001-test",
    topic: "test",
    scope: ["architecture"],
    phase,
    createdAt: new Date().toISOString(),
    linkedDocs: {},
    modelUsage: [],
    modelFallbacks: {},
    oracleReviews: [],
    ...overrides,
  };
}

describe("canRunCommand [bug-A]", () => {
  it("[bug-A] allows scout in brief phase with brief.md present", () => {
    const r = canRunCommand("scout", makeThread("brief"), new Set(["brief.md"]));
    expect(r.allowed).toBe(true);
    expect(r.isRerun).toBe(false);
  });

  it("[bug-A] blocks scout in brief phase when brief.md missing", () => {
    const r = canRunCommand("scout", makeThread("brief"));
    expect(r.allowed).toBe(false);
    expect(r.errorMessage).toContain("brief.md");
  });

  it("[bug-A] blocks evaluate with no measurement contract", () => {
    const r = canRunCommand("evaluate", makeThread("contract"));
    expect(r.allowed).toBe(false);
    expect(r.errorMessage).toContain("measurement contract");
  });

  it("[bug-A] allows evaluate with measurement contract linked", () => {
    const r = canRunCommand(
      "evaluate",
      makeThread("contract", { linkedDocs: { measurement: "/path/contract.md" } })
    );
    expect(r.allowed).toBe(true);
  });

  it("[bug-A] allows oracle at docs phase when designDoc linked", () => {
    const r = canRunCommand(
      "oracle",
      makeThread("docs", { linkedDocs: { designDoc: "/path/design.md" } })
    );
    expect(r.allowed).toBe(true);
  });

  it("[bug-A] blocks oracle at docs phase with no linked doc", () => {
    const r = canRunCommand("oracle", makeThread("docs"));
    expect(r.allowed).toBe(false);
  });

  it("[bug-A] blocks contract with no linked doc", () => {
    const r = canRunCommand("contract", makeThread("docs"), new Set(["synthesis.md"]));
    expect(r.allowed).toBe(false);
    expect(r.errorMessage).toContain("linked doc");
  });

  it("[bug-A] allows contract with linked ADR", () => {
    const r = canRunCommand(
      "contract",
      makeThread("docs", { linkedDocs: { adr: ["/path/adr.md"] } }),
      new Set(["synthesis.md"])
    );
    expect(r.allowed).toBe(true);
  });

  it("[bug-A] new/status/resume always allowed in any phase", () => {
    for (const phase of ["brief", "scout", "closed"] as ResearchPhase[]) {
      expect(canRunCommand("new", makeThread(phase)).allowed).toBe(true);
      expect(canRunCommand("status", makeThread(phase)).allowed).toBe(true);
      expect(canRunCommand("resume", makeThread(phase)).allowed).toBe(true);
    }
  });

  it("[bug-A] isRerun=true when phase is past allowed window (scout at docs phase)", () => {
    const r = canRunCommand("scout", makeThread("docs"), new Set(["brief.md"]));
    expect(r.allowed).toBe(true);
    expect(r.isRerun).toBe(true);
  });

  it("[bug-A] blocks groom when brief.md missing (too early + missing file)", () => {
    const r = canRunCommand("groom", makeThread("scout"));
    expect(r.allowed).toBe(false);
    expect(r.errorMessage).toContain("brief.md");
  });

  it("[bug-A] blocks prd with no linked doc even in docs phase", () => {
    const r = canRunCommand("prd", makeThread("docs"), new Set(["synthesis.md"]));
    expect(r.allowed).toBe(false);
    expect(r.errorMessage).toContain("linked ADR");
  });

  it("[bug-A] allows prd with linked RFC", () => {
    const r = canRunCommand(
      "prd",
      makeThread("docs", { linkedDocs: { rfc: "/path/rfc.md" } }),
      new Set(["synthesis.md"])
    );
    expect(r.allowed).toBe(true);
  });
});
