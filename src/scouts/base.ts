import { join } from "node:path";

export interface ScoutTaskSpec {
  agentName: string;
  /** Resolved model string, e.g. "anthropic/claude-haiku-4.5" */
  model: string;
  /** Full rendered prompt content for the subagent. */
  prompt: string;
  /** Absolute path where the subagent should write its markdown output. */
  outputFile: string;
  /** Short label for display (e.g. "web", "oss"). */
  label: string;
}

/** Resolve the raw output file path for a scout within a thread. */
export function scoutOutputPath(threadDir: string, prefix: string, label: string): string {
  return join(threadDir, "raw", `${prefix}-${label}.md`);
}

/**
 * Build the single LLM instruction message that drives all scouts in parallel.
 *
 * The LLM receives this as a user message via sendUserMessage and uses the
 * `subagent` tool (from pi-subagents) to execute each task, then writes
 * each output to the specified file path.
 */
export function buildScoutInstruction(
  threadId: string,
  threadDir: string,
  tasks: ScoutTaskSpec[]
): string {
  const taskBlocks = tasks
    .map(
      (t, i) => `
### Scout ${i + 1}: ${t.label}
- agent: \`${t.agentName}\`
- model: \`${t.model}\`
- output: \`${t.outputFile}\`

<task>
${t.prompt}
</task>`.trim()
    )
    .join("\n\n");

  return `Run ${tasks.length} parallel research scouts for thread \`${threadId}\`.

## Instructions

1. Use the \`subagent\` tool in **parallel mode** — dispatch all ${tasks.length} scouts at the same time.
2. Pass the specified \`model\` for each scout in the subagent call's \`model\` field.
3. Each scout's task content is provided below.
4. After each scout completes, prepend YAML frontmatter to the output before writing:
   \`\`\`yaml
   ---
   agent: <agentName>
   model: <resolvedModel>
   generated_at: <ISO timestamp>
   thread_id: ${threadId}
   ---
   \`\`\`
   Then write to the specified output file using the \`write\` tool. Do NOT summarise or truncate.
5. Once all ${tasks.length} scouts are done and their outputs are written, confirm with a brief summary:
   - Which scouts succeeded / failed
   - File paths written
   - Any open questions flagged by scouts
5. Do not run \`/research:groom\` automatically. Wait for the operator.

## Scout tasks

${taskBlocks}

## Output directory

All files must be written inside: \`${threadDir}/raw/\`
`.trim();
}
