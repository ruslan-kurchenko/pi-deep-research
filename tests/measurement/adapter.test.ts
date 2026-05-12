import { describe, expect, it } from "vitest";
import type { MeasurementContract } from "../../src/measurement/adapter.js";
import { computeResults, formatResultsRows } from "../../src/measurement/adapter.js";
import { ManualAdapter } from "../../src/measurement/manual.js";

const CONTRACT: MeasurementContract = {
  title: "Voice dead-air reduction",
  researchThreadId: "001-voice-north-star",
  linkedDocPath: "docs/design-docs/001-voice-north-star.md",
  adapter: "manual",
  metrics: [
    {
      name: "dead_air_ms_p50",
      description: "End-of-utterance to first audio token latency, p50",
      unit: "ms",
      baselineValue: "800",
      predictedP50: "350",
      predictedP95: "700",
      confidence: "medium",
      measurementMethod: "Langfuse score: voice.turn.dead_air_ms",
      rollbackThreshold: "p50 > 900ms",
    },
    {
      name: "barge_in_false_positive_rate",
      description: "Rate of incorrect interruptions",
      unit: "%",
      baselineValue: "12",
      predictedP50: "5",
      confidence: "low",
      measurementMethod: "Langfuse score: voice.barge_in.false_positive",
    },
  ],
  rollbackCriteria: "dead_air_ms_p50 > 900ms over 100 calls",
  sampleSizeRationale: "100 calls per variant for 80% power at 20% effect size",
  measurementWindow: "48 hours",
  caveats: "Network variance may inflate p95",
};

describe("ManualAdapter", () => {
  it("returns stub results for all metrics", async () => {
    const adapter = new ManualAdapter();
    const results = await adapter.measure(CONTRACT);
    expect(results).toHaveLength(2);
    expect(results[0]!.actual).toMatch(/TODO/);
    expect(results[0]!.name).toBe("dead_air_ms_p50");
    expect(results[1]!.name).toBe("barge_in_false_positive_rate");
  });

  it("adapter name is 'manual'", () => {
    expect(new ManualAdapter().name).toBe("manual");
  });
});

describe("computeResults", () => {
  it("marks metric as unknown when no actual measurement found", () => {
    const results = computeResults(CONTRACT, []);
    expect(results[0]!.status).toBe("unknown");
    expect(results[0]!.actual).toBe("not measured");
  });

  it("fills in actual when measurement exists", () => {
    const actuals = [{ name: "dead_air_ms_p50", actual: "p50: 410, p95: 680 (n=150)", measuredAt: new Date().toISOString(), source: "langfuse" }];
    const results = computeResults(CONTRACT, actuals);
    expect(results[0]!.actual).toBe("p50: 410, p95: 680 (n=150)");
    expect(results[0]!.predicted).toBe("350");
  });
});

describe("formatResultsRows", () => {
  it("renders a markdown table row per result", () => {
    const results = computeResults(CONTRACT, []);
    const rows = formatResultsRows(results);
    expect(rows).toContain("dead_air_ms_p50");
    expect(rows).toContain("barge_in_false_positive_rate");
    expect(rows.split("\n")).toHaveLength(2);
  });
});
