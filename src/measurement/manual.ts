import type { ActualKPI, MeasurementAdapter, MeasurementContract } from "./adapter.js";

/**
 * Manual measurement adapter.
 * Returns stub results with TODO markers — the operator fills them in manually.
 * Always succeeds. Used when no automated adapter is configured.
 */
export class ManualAdapter implements MeasurementAdapter {
  readonly name = "manual";

  async measure(contract: MeasurementContract): Promise<ActualKPI[]> {
    return contract.metrics.map((kpi) => ({
      name: kpi.name,
      actual: `TODO: fill from ${kpi.measurementMethod}`,
      measuredAt: new Date().toISOString(),
      source: "manual",
    }));
  }
}
