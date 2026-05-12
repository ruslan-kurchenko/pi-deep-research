import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { renderTemplate } from "./render.js";
import { readOptional } from "../lib/files.js";

const TEMPLATES_DIR = new URL("../../templates/prompts/", import.meta.url).pathname;

export type OracleGate = "after-alternatives" | "after-doc";

/** Absolute path where oracle writes its review. */
export function oracleOutputPath(threadDir: string, gate: OracleGate): string {
  return join(threadDir, "oracle", `${gate}.md`);
}

/** Ensure the oracle/ subdirectory exists inside a thread dir. */
export async function ensureOracleDir(threadDir: string): Promise<void> {
  await mkdir(join(threadDir, "oracle"), { recursive: true });
}

interface OracleContext {
  threadId: string;
  threadDir: string;
  gate: OracleGate;
  brief: string;
  oracleModel: string;
}

/**
 * Build the LLM instruction that dispatches the oracle subagent,
 * then surfaces its review to the operator for a decision.
 *
 * contextMd is gate-specific:
 *   after-alternatives → synthesis.md + alternatives.md
 *   after-doc          → the final doc (rfc/design-doc/prd)
 */
export async function buildOracleInstruction(
  ctx: OracleContext,
  contextMd: string
): Promise<string> {
  const outputPath = oracleOutputPath(ctx.threadDir, ctx.gate);
  const today = new Date().toISOString();

  // Load oracle prompt template
  const { readFile } = await import("node:fs/promises");
  const templateRaw = await readFile(
    join(TEMPLATES_DIR, "oracle.md"),
    "utf8"
  );

  const oracleTask = renderTemplate(templateRaw, {
    gate: ctx.gate,
    brief: ctx.brief,
    context_section: contextMd,
    output_path: outputPath,
    model: ctx.oracleModel,
    thread_id: ctx.threadId,
    generated_at: today,
  });

  return `Run /research:oracle on thread \`${ctx.threadId}\` at gate \`${ctx.gate}\`.

## Step 1 — Oracle review

Use the \`subagent\` tool to dispatch the \`research-oracle\` agent with:
- **model:** \`${ctx.oracleModel}\`
- **thinking:** high
- **task:**

<task>
${oracleTask}
</task>

## Step 2 — Surface review to operator

After the oracle completes and writes to \`${outputPath}\`, read the file and present a structured summary:

\`\`\`
Oracle verdict: [APPROVE|REVISE|REJECT] (confidence: X.XX)
Top concerns:
  1. [CRITICAL/HIGH] <concern>
  2. [CRITICAL/HIGH] <concern>
  3. [CRITICAL/HIGH] <concern> (if present)
Suggested actions: <count> actions listed
\`\`\`

Then ask the operator:
"How do you want to proceed?
  (1) Accept all concerns — I'll re-run the upstream step with oracle feedback appended
  (2) Accept some — tell me which concerns to carry forward (by number)
  (3) Dismiss — noted in thread state, proceed unchanged
  (4) Iterate — ask the oracle a follow-up question"

## Step 3 — Act on operator decision

- **(1) Accept all:** Append oracle concerns to the upstream context and re-run the previous step (\`/research:alternatives\` or the relevant doc command). Ask operator: "Re-run with all ${ctx.gate === "after-alternatives" ? "alternatives + cross-checks" : "doc generation"}? (y/n)"
- **(2) Accept some:** Operator lists concern numbers. Carry only those forward. Same re-run gate as (1).
- **(3) Dismiss:** Note the dismissal (with operator's reason if given) at the bottom of \`${outputPath}\`. No re-run.
- **(4) Iterate:** Send the follow-up question to the oracle subagent with the same model. Append its response to \`${outputPath}\`.

After handling the operator decision, record it in \`${join(ctx.threadDir, ".state.json")}\` under \`oracleReviews\`:
\`\`\`json
{
  "gate": "${ctx.gate}",
  "outputPath": "${outputPath}",
  "verdict": "<APPROVE|REVISE|REJECT from oracle>",
  "operatorDecision": "<accept_all|accept_some|dismiss|iterate>",
  "timestamp": "<ISO timestamp>"
}
\`\`\`
Append this entry to the existing \`oracleReviews\` array — do not overwrite the array.`.trim();
}

/**
 * Build the gate-specific context markdown for the oracle.
 * after-alternatives: brief + synthesis + alternatives + cross-checks
 * after-doc:          brief + final doc content
 */
export async function buildOracleContext(
  threadDir: string,
  gate: OracleGate,
  linkedDocPath?: string
): Promise<string> {
  if (gate === "after-doc" && linkedDocPath) {
    const doc = await readOptional(linkedDocPath);
    return `## Document under review\n\n${doc ?? "_Document not found._"}`;
  }

  // after-alternatives: include synthesis + alternatives + cross-checks
  const synthesis = await readOptional(join(threadDir, "synthesis.md"));
  const alternatives = await readOptional(join(threadDir, "alternatives.md"));
  const challenger = await readOptional(join(threadDir, "cross-checks", "challenger.md"));
  const devils = await readOptional(join(threadDir, "cross-checks", "devils-advocate.md"));

  const sections: string[] = [];
  if (synthesis) sections.push(`## Synthesis\n\n${synthesis.slice(0, 4000)}`);
  if (alternatives) sections.push(`## Alternatives matrix\n\n${alternatives}`);
  if (challenger) sections.push(`## Challenger review\n\n${challenger}`);
  if (devils) sections.push(`## Devil's advocate\n\n${devils}`);

  return sections.join("\n\n---\n\n") || "_No context files found._";
}
