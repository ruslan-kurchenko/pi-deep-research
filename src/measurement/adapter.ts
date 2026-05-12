export interface PredictedKPI {
  name: string;
  description: string;
  unit: string;
  baselineValue?: string;
  predictedP50?: string;
  predictedP95?: string;
  confidence: "high" | "medium" | "low";
  measurementMethod: string;
  rollbackThreshold?: string;
}

export interface MeasurementContract {
  title: string;
  researchThreadId: string;
  linkedDocPath: string;
  adapter: string;
  metrics: PredictedKPI[];
  rollbackCriteria: string;
  sampleSizeRationale: string;
  measurementWindow: string;
  caveats: string;
}

export interface ActualKPI {
  name: string;
  actual: string;
  measuredAt: string;
  source: string;
}

export interface EvaluationResult {
  metric: string;
  predicted: string;
  actual: string;
  delta: string;
  status: "within-range" | "regression" | "exceeded" | "unknown";
}

/** Common interface all adapters implement. */
export interface MeasurementAdapter {
  readonly name: string;
  measure(contract: MeasurementContract): Promise<ActualKPI[]>;
}

export function computeResults(
  contract: MeasurementContract,
  actuals: ActualKPI[]
): EvaluationResult[] {
  return contract.metrics.map((kpi) => {
    const actual = actuals.find((a) => a.name === kpi.name);
    if (!actual) {
      return {
        metric: kpi.name,
        predicted: kpi.predictedP50 ?? "—",
        actual: "not measured",
        delta: "—",
        status: "unknown" as const,
      };
    }
    return {
      metric: kpi.name,
      predicted: kpi.predictedP50 ?? "—",
      actual: actual.actual,
      delta: "—", // caller fills in numeric delta when applicable
      status: "unknown" as const, // caller determines status against rollback threshold
    };
  });
}

/** Format EvaluationResults as a Markdown table body (rows only). */
export function formatResultsRows(results: EvaluationResult[]): string {
  return results
    .map((r) => `| ${r.metric} | ${r.predicted} | ${r.actual} | ${r.delta} | ${r.status} |`)
    .join("\n");
}
