import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderTemplate } from "../docs/render.js";

const TEMPLATES_DIR = new URL("../../templates/prompts/", import.meta.url).pathname;

async function loadPromptTemplate(name: string): Promise<string> {
  return readFile(join(TEMPLATES_DIR, `${name}.md`), "utf8");
}

// ── Groom / synthesis ────────────────────────────────────────────────────────

export async function buildGroomInstruction(
  threadId: string,
  threadDir: string,
  brief: string,
  rawScouts: string
): Promise<string> {
  const synthPrompt = await loadPromptTemplate("synthesizer");
  const rendered = renderTemplate(synthPrompt, {
    brief,
    raw_findings: rawScouts,
  });

  return `Run /research:groom on thread \`${threadId}\`.

## Step 1 — Synthesize

Use the \`subagent\` tool to dispatch the \`research-synthesizer\` agent with this task:

<task>
${rendered}
</task>

After the synthesizer completes, write its full output to:
\`${join(threadDir, "synthesis.md")}\`

## Step 2 — Review with operator

Read \`${join(threadDir, "synthesis.md")}\` and present a concise summary to the operator:
- Top 3–5 insights
- Overall confidence score
- Confidence gaps (claims below 0.7)

Ask the operator: "Does this synthesis look right? Any areas to dig deeper before we move to alternatives?"

Wait for the operator's response before proceeding to \`/research:alternatives\`.`.trim();
}

// ── Alternatives matrix ──────────────────────────────────────────────────────

export function buildAlternativesInstruction(
  threadId: string,
  threadDir: string,
  brief: string,
  synthesis: string,
  rubric: string | null
): string {
  const rubricSection = rubric
    ? `## Rubric (operator-defined)\n\n${rubric}`
    : `## Rubric\n\nNo rubric defined yet. Before generating alternatives, ask the operator:\n"What dimensions matter most for scoring alternatives? (e.g. latency, cost, ops burden, reversibility, team familiarity, time-to-ship)"\nWait for their answer, then use those dimensions.`;

  return `Run /research:alternatives on thread \`${threadId}\`.

## Research brief
${brief}

## Synthesis
${synthesis}

${rubricSection}

## Instructions

1. Generate 1–5 concrete alternatives PLUS "Do nothing (status quo)" as Option 0.
2. Score each on the agreed rubric dimensions (1–5 scale).
3. Write the alternatives matrix to \`${join(threadDir, "alternatives.md")}\` in this format:

\`\`\`markdown
# Alternatives: <topic>

## Rubric dimensions
| Dimension | Weight | Rationale |
|---|---|---|
| <dim> | <1-3> | <why it matters> |

## Alternatives matrix
| Alternative | <dim1> | <dim2> | ... | Weighted score |
|---|---|---|---|---|
| 0. Do nothing | ... |
| 1. <option> | ... |

## Recommendation
**Recommended: Option N — <name>**
Rationale: <2–3 sentences>

## Key trade-offs
<prose: what you gain and what you give up with the recommended option>
\`\`\`

4. Run \`research-challenger\` and \`research-devils-advocate\` in **parallel** with these tasks:

**Challenger task:** Read \`${join(threadDir, "alternatives.md")}\` and the brief above.
${renderChallengerTask(threadDir)}

**Devil's advocate task:** Read \`${join(threadDir, "alternatives.md")}\` and the brief above.
${renderDevilsAdvocateTask(threadDir)}

5. Write challenger output to \`${join(threadDir, "cross-checks", "challenger.md")}\`
   Write devil's advocate output to \`${join(threadDir, "cross-checks", "devils-advocate.md")}\`

6. Present the recommendation + cross-check highlights to the operator and ask for confirmation before proceeding to \`/research:document\`.`.trim();
}

function renderChallengerTask(threadDir: string): string {
  return `Find the strongest arguments AGAINST the top recommendation. Identify hidden assumptions, missing alternatives, overconfident claims, practical blockers, and second-order effects. Write findings to \`${join(threadDir, "cross-checks", "challenger.md")}\`.`;
}

function renderDevilsAdvocateTask(threadDir: string): string {
  return `Make the strongest honest case for "do nothing" (Option 0). Cover migration cost, reversibility, opportunity cost, regression risk, and timeline to benefit. Write findings to \`${join(threadDir, "cross-checks", "devils-advocate.md")}\`.`;
}

// ── Rubric builder ───────────────────────────────────────────────────────────

export function buildRubricPrompt(scope: string[]): string {
  return `Based on the research scope (${scope.join(", ")}), what dimensions should we use to score alternatives?

Suggested dimensions for this scope:
${suggestDimensions(scope)}

Reply with the dimensions you want, their relative weights (1=low, 2=medium, 3=high), and a one-line rationale for each. Or say "use the suggestions" to accept the defaults.`;
}

function suggestDimensions(scope: string[]): string {
  const dims: string[] = [];
  if (scope.includes("architecture") || scope.includes("combined")) {
    dims.push("- **Latency impact** (weight 3) — effect on end-user response time");
    dims.push("- **Ops burden** (weight 2) — infra complexity added");
    dims.push("- **Reversibility** (weight 2) — how easily we could undo this");
    dims.push("- **Vendor risk** (weight 2) — dependency on external parties");
  }
  if (scope.includes("nfr") || scope.includes("combined")) {
    dims.push("- **Cost/run** (weight 2) — per-request or per-month cost change");
    dims.push("- **Observability** (weight 1) — how visible the system behaviour becomes");
  }
  if (scope.includes("feature") || scope.includes("module")) {
    dims.push("- **Time-to-ship** (weight 3) — engineering effort in weeks");
    dims.push("- **Team familiarity** (weight 2) — existing expertise on the team");
  }
  dims.push("- **Do nothing cost** (weight 3) — cost of NOT making this change");
  return dims.length > 0 ? dims.join("\n") : "- Latency, cost, complexity, reversibility, risk";
}
