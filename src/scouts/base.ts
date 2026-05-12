import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ScoutTask {
  agentName: string;
  task: string;
  outputFile: string;
}

export interface SubagentTool {
  call(params: {
    agent: string;
    task: string;
  }): Promise<{ output: string; error?: string }>;
}

export interface ScoutResult {
  agentName: string;
  outputFile: string;
  success: boolean;
  error?: string;
}

/**
 * Dispatch a single scout and write its output to disk.
 * `subagent` is the pi-subagents tool handle (or a mock in tests).
 */
export async function runScout(
  subagent: SubagentTool,
  task: ScoutTask
): Promise<ScoutResult> {
  try {
    const result = await subagent.call({ agent: task.agentName, task: task.task });
    if (result.error) {
      return { agentName: task.agentName, outputFile: task.outputFile, success: false, error: result.error };
    }
    await writeFile(task.outputFile, result.output, "utf8");
    return { agentName: task.agentName, outputFile: task.outputFile, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { agentName: task.agentName, outputFile: task.outputFile, success: false, error: msg };
  }
}

/**
 * Dispatch multiple scouts in parallel and collect results.
 * Never throws — failures are captured in the result objects.
 */
export async function runScoutsParallel(
  subagent: SubagentTool,
  tasks: ScoutTask[]
): Promise<ScoutResult[]> {
  return Promise.all(tasks.map((t) => runScout(subagent, t)));
}

/** Format a list of ScoutResults for display in the TUI. */
export function formatScoutSummary(results: ScoutResult[]): string {
  return results
    .map((r) => {
      const icon = r.success ? "✓" : "✗";
      const label = r.agentName.replace("research-", "");
      const detail = r.success ? r.outputFile.split("/").slice(-2).join("/") : (r.error ?? "unknown error");
      return `  ${icon} ${label}: ${detail}`;
    })
    .join("\n");
}

/** Resolve the raw output file path for a scout within a thread. */
export function scoutOutputPath(threadDir: string, prefix: string, label: string): string {
  return join(threadDir, "raw", `${prefix}-${label}.md`);
}
