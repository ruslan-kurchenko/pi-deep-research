import type { ActualKPI, MeasurementAdapter, MeasurementContract } from "./adapter.js";

export interface LangfuseConfig {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  /** Default trace filter to apply (e.g. name prefix). */
  traceFilter?: string;
  /** Window in hours to query. Default: 24. */
  windowHours?: number;
}

interface LangfuseScore {
  name: string;
  value: number;
  traceId: string;
  timestamp: string;
}

interface LangfuseScoresResponse {
  data: LangfuseScore[];
}

/**
 * Langfuse measurement adapter.
 * Queries Langfuse scores API by metric name.
 * Each metric name in the contract must match a Langfuse score name.
 *
 * Env vars (fallback if config not provided):
 *   LANGFUSE_BASE_URL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY
 */
export class LangfuseAdapter implements MeasurementAdapter {
  readonly name = "langfuse";
  private readonly config: LangfuseConfig;

  constructor(config?: Partial<LangfuseConfig>) {
    const base: LangfuseConfig = {
      baseUrl: config?.baseUrl ?? process.env["LANGFUSE_BASE_URL"] ?? "https://cloud.langfuse.com",
      publicKey: config?.publicKey ?? process.env["LANGFUSE_PUBLIC_KEY"] ?? "",
      secretKey: config?.secretKey ?? process.env["LANGFUSE_SECRET_KEY"] ?? "",
      windowHours: config?.windowHours ?? 24,
    };
    if (config?.traceFilter !== undefined) base.traceFilter = config.traceFilter;
    this.config = base;
  }

  async measure(contract: MeasurementContract): Promise<ActualKPI[]> {
    const results: ActualKPI[] = [];

    for (const kpi of contract.metrics) {
      try {
        const scores = await this.fetchScores(kpi.name);
        if (scores.length === 0) {
          results.push({
            name: kpi.name,
            actual: "no data found",
            measuredAt: new Date().toISOString(),
            source: `langfuse:${this.config.baseUrl}`,
          });
          continue;
        }

        const values = scores.map((s) => s.value);
        const p50 = percentile(values, 50);
        const p95 = percentile(values, 95);
        results.push({
          name: kpi.name,
          actual: `p50: ${p50.toFixed(1)}, p95: ${p95.toFixed(1)} (n=${values.length})`,
          measuredAt: new Date().toISOString(),
          source: `langfuse:${this.config.baseUrl}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          name: kpi.name,
          actual: `error: ${msg}`,
          measuredAt: new Date().toISOString(),
          source: `langfuse:${this.config.baseUrl}`,
        });
      }
    }

    return results;
  }

  private async fetchScores(scoreName: string): Promise<LangfuseScore[]> {
    if (!this.config.publicKey || !this.config.secretKey) {
      throw new Error("Langfuse credentials not configured. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY.");
    }

    const from = new Date(Date.now() - (this.config.windowHours ?? 24) * 3600 * 1000).toISOString();
    const params = new URLSearchParams({ name: scoreName, fromTimestamp: from, limit: "1000" });
    const url = `${this.config.baseUrl}/api/public/scores?${params}`;

    const credentials = Buffer.from(`${this.config.publicKey}:${this.config.secretKey}`).toString("base64");
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    });

    if (!res.ok) throw new Error(`Langfuse API error ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as LangfuseScoresResponse;
    return body.data ?? [];
  }
}

function percentile(sorted: number[], p: number): number {
  const arr = [...sorted].sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, idx)] ?? 0;
}
