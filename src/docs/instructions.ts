import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderTemplate } from "./render.js";
import type { DocType } from "./docpaths.js";

const TEMPLATES_DIR = new URL("../../templates/", import.meta.url).pathname;

async function loadDocTemplate(name: string): Promise<string> {
  return readFile(join(TEMPLATES_DIR, `${name}.md`), "utf8");
}

interface DocContext {
  threadId: string;
  threadDir: string;
  brief: string;
  synthesis: string;
  alternatives: string;
  outputPath: string;
  docNum: number;
  slug: string;
  today: string;
}

// ── ADR ──────────────────────────────────────────────────────────────────────

export async function buildAdrInstruction(ctx: DocContext, title: string): Promise<string> {
  const template = await loadDocTemplate("adr");
  return `Run /research:adr on thread \`${ctx.threadId}\`.

## Context files

### Brief
${ctx.brief}

### Synthesis (summary)
${ctx.synthesis.slice(0, 3000)}

### Alternatives
${ctx.alternatives}

## Instructions

Fill in the ADR template below. Write the completed document to:
\`${ctx.outputPath}\`

Create parent directories if needed.

For **Alternatives considered**: pull from the alternatives matrix above — include all options that were scored.
For **Predicted KPIs**: extract from the synthesis confidence section.
For **Consequences**: be honest — list real negatives, not just positives.

## Template

${renderTemplate(template, {
  number: String(ctx.docNum).padStart(3, "0"),
  title: title || ctx.slug,
  date: ctx.today,
  status: "Proposed",
  deciders: "Ruslan Kurchenko",
  research_thread_id: ctx.threadId,
  context: "<!-- fill from brief + synthesis -->",
  decision: "<!-- fill from recommendation in alternatives.md -->",
  alternatives_considered: "<!-- fill from alternatives matrix -->",
  consequences_positive: "<!-- fill from synthesis -->",
  consequences_negative: "<!-- fill from synthesis -->",
  consequences_neutral: "<!-- fill from synthesis -->",
  predicted_kpis: "<!-- fill from synthesis confidence section -->",
  references: `research/${ctx.threadId}/synthesis.md\nresearch/${ctx.threadId}/alternatives.md`,
})}`.trim();
}

// ── RFC ──────────────────────────────────────────────────────────────────────

export async function buildRfcInstruction(ctx: DocContext): Promise<string> {
  const template = await loadDocTemplate("rfc");
  return `Run /research:rfc on thread \`${ctx.threadId}\`.

## Context files

### Brief
${ctx.brief}

### Synthesis (summary)
${ctx.synthesis.slice(0, 4000)}

### Alternatives
${ctx.alternatives}

## Instructions

Fill in the RFC template below. Write the completed document to:
\`${ctx.outputPath}\`

Create parent directories if needed.

Key guidance:
- **Summary**: 2–3 sentences, what changes and why
- **Motivation**: the pain from the brief — be specific, cite evidence from synthesis
- **Detailed design**: describe the proposed solution from the alternatives recommendation
- **Alternatives**: all scored options from the matrix
- **Drawbacks**: real ones, pulled from challenger.md if available
- **Migration plan**: phased rollout with rollback criteria

## Template

${renderTemplate(template, {
  number: String(ctx.docNum).padStart(3, "0"),
  title: ctx.slug.replace(/-/g, " "),
  date: ctx.today,
  status: "Draft",
  authors: "Ruslan Kurchenko",
  research_thread_id: ctx.threadId,
  summary: "<!-- fill -->",
  motivation: "<!-- fill from brief + synthesis -->",
  detailed_design: "<!-- fill from alternatives recommendation -->",
  alternatives: "<!-- fill from alternatives matrix -->",
  drawbacks: "<!-- fill from cross-checks/challenger.md -->",
  predicted_kpis: "<!-- fill from synthesis -->",
  open_questions: "<!-- fill from synthesis confidence gaps -->",
  migration_plan: "<!-- fill -->",
  related_adrs: "<!-- fill if any -->",
  references: `research/${ctx.threadId}/synthesis.md`,
})}`.trim();
}

// ── Design Doc ───────────────────────────────────────────────────────────────

export async function buildDesignDocInstruction(ctx: DocContext): Promise<string> {
  const template = await loadDocTemplate("design-doc");
  return `Run /research:design-doc on thread \`${ctx.threadId}\`.

## Context files

### Brief
${ctx.brief}

### Synthesis
${ctx.synthesis.slice(0, 5000)}

### Alternatives
${ctx.alternatives}

## Instructions

Fill in the Design Doc template below. Write the completed document to:
\`${ctx.outputPath}\`

Create parent directories if needed.

**C4 diagrams**: Use the \`research-architect\` subagent to generate Mermaid C4 diagrams:
- C4 Context diagram (system boundaries, external actors)
- C4 Container diagram (internal services/components for CURRENT state)
- C4 Container diagram (PROPOSED state from the recommended alternative)

Pass the brief + synthesis to the architect so it understands the domain.

**Ubiquitous language**: Extract domain terms from the brief and synthesis. Include the key terms that appear in code, docs, and conversations.

**Alternatives matrix**: Expand the scored matrix from alternatives.md — add a narrative trade-off paragraph for the top 2–3 options.

## Template

${renderTemplate(template, {
  title: ctx.slug.replace(/-/g, " "),
  date: ctx.today,
  status: "Draft",
  authors: "Ruslan Kurchenko",
  research_thread_id: ctx.threadId,
  tldr: "<!-- 2–3 sentence summary of the proposal -->",
  goals: "<!-- fill from brief -->",
  non_goals: "<!-- fill from brief -->",
  background: "<!-- fill from synthesis background section -->",
  ubiquitous_language: "<!-- fill: key domain terms and their definitions -->",
  current_architecture_diagram: "<!-- C4 diagram: current state (Mermaid) -->",
  current_architecture_description: "<!-- fill from repo-scout findings -->",
  proposed_architecture_diagram: "<!-- C4 diagram: proposed state (Mermaid) -->",
  proposed_architecture_description: "<!-- fill from recommended alternative -->",
  rubric_dimension_1: "Latency",
  rubric_dimension_2: "Cost",
  rubric_dimension_3: "Complexity",
  alternatives_matrix_rows: "<!-- fill from alternatives.md -->",
  tradeoffs: "<!-- fill -->",
  risks: "<!-- fill from cross-checks -->",
  migration_plan: "<!-- fill -->",
  predicted_kpis: "<!-- fill from synthesis -->",
  references: `research/${ctx.threadId}/synthesis.md`,
})}`.trim();
}

// ── PRD ──────────────────────────────────────────────────────────────────────

export async function buildPrdInstruction(
  ctx: DocContext,
  linkedDocPaths: string[]
): Promise<string> {
  const template = await loadDocTemplate("prd");
  return `Run /research:prd on thread \`${ctx.threadId}\`.

## Context files

### Brief
${ctx.brief}

### Synthesis (summary)
${ctx.synthesis.slice(0, 2000)}

### Linked decision documents
${linkedDocPaths.length > 0 ? linkedDocPaths.map((p) => `- \`${p}\``).join("\n") : "None yet — link ADRs/RFC/Design Doc first."}

## Instructions

Fill in the PRD template below. Write the completed document to:
\`${ctx.outputPath}\`

Create parent directories if needed.

The PRD is the project plan — it cites the technical decisions already made.
Do NOT re-explain the technical solution. Reference the linked docs.
Focus on: user impact, phased delivery, success metrics, measurement contract reference, timeline.

## Template

${renderTemplate(template, {
  title: ctx.slug.replace(/-/g, " "),
  date: ctx.today,
  status: "Draft",
  authors: "Ruslan Kurchenko",
  research_thread_id: ctx.threadId,
  problem: "<!-- fill from brief motivation -->",
  users_affected: "<!-- fill: who experiences this today + the proposed change -->",
  success_metrics: "<!-- fill from synthesis predicted KPIs -->",
  scope_in: "<!-- fill from brief + recommended alternative -->",
  scope_out: "<!-- fill: what's explicitly excluded -->",
  phases: "<!-- fill: phased plan referencing linked docs -->",
  measurement_contract_path: `docs/measurement/${String(ctx.docNum).padStart(3, "0")}-${ctx.slug}.md (run /research:contract)`,
  decision_log_rows: linkedDocPaths.map((p) => `| ${p.split("/").pop()} | ${p} | ${ctx.today} |`).join("\n"),
  timeline: "<!-- fill: rough estimates per phase -->",
  open_questions: "<!-- fill from synthesis confidence gaps -->",
})}`.trim();
}

// ── Smart doc-advisor instruction ─────────────────────────────────────────────

export async function buildDocAdvisorInstruction(
  threadId: string,
  threadDir: string,
  brief: string,
  alternativesSummary: string
): Promise<string> {
  const template = await loadDocTemplate("../templates/prompts/doc-advisor");

  // fallback if template path fails
  let rendered: string;
  try {
    rendered = renderTemplate(template, { brief, alternatives_summary: alternativesSummary });
  } catch {
    rendered = `Brief:\n${brief}\n\nAlternatives summary:\n${alternativesSummary}`;
  }

  return `Run /research:document on thread \`${threadId}\`.

Use the \`research-doc-advisor\` subagent with this task:

<task>
${rendered}
</task>

After the advisor responds, present the recommendation to the operator:
"The doc advisor recommends: **[FORMAT]** — [RATIONALE]"

Ask the operator to confirm or choose a different format:
1. ADR (single decision, 1 page)
2. Multiple ADRs
3. RFC (multi-decision, 3–5 pages)
4. Design Doc (architecture-wide, with C4 diagrams)
5. PRD (project plan, cites existing docs)

Then run the corresponding /research:adr, /research:rfc, /research:design-doc, or /research:prd command.`.trim();
}

// ── Contract instruction ──────────────────────────────────────────────────────

export async function buildContractInstruction(
  threadId: string,
  threadDir: string,
  linkedDocPath: string,
  linkedDocContent: string,
  synthesis: string,
  outputPath: string,
  docNum: number,
  slug: string,
  today: string
): Promise<string> {
  const template = await loadDocTemplate("measurement");
  const kpiPromptTemplate = await readFile(
    join(TEMPLATES_DIR, "prompts", "kpi-architect.md"),
    "utf8"
  );

  const kpiTask = renderTemplate(kpiPromptTemplate, {
    brief: `Research thread: ${threadId}`,
    proposal: linkedDocContent.slice(0, 4000),
  });

  return `Run /research:contract on thread \`${threadId}\`.

Use the \`research-kpi-architect\` subagent with this task:

<task>
${kpiTask}
</task>

After the KPI architect responds, use its output to fill the measurement template and write to:
\`${outputPath}\`

Create parent directories if needed.

The template placeholder values:
- title: "${slug.replace(/-/g, " ")}"
- date: "${today}"
- research_thread_id: "${threadId}"
- linked_doc_path: "${linkedDocPath}"
- adapter: "manual (change to langfuse if LANGFUSE_* env vars are set)"
- metrics: from KPI architect output
- rollback_criteria: from KPI architect output
- sample_size_rationale: from KPI architect output
- measurement_window: from KPI architect output
- caveats: from KPI architect output

## Measurement template

${template}`.trim();
}

// ── Evaluate instruction ──────────────────────────────────────────────────────

export function buildEvaluateInstruction(
  threadId: string,
  contractPath: string,
  contractContent: string,
  outputPath: string,
  today: string,
  adapterName: string
): string {
  return `Run /research:evaluate on thread \`${threadId}\`.

## Measurement contract
${contractContent}

## Instructions

1. Read the measurement contract above.
2. For each metric, retrieve the actual value using the adapter: **${adapterName}**
   - If adapter is "manual": the actual values are filled in by the operator — check if they're present in the contract file, otherwise insert TODO markers.
   - If adapter is "langfuse": query the Langfuse scores API for each metric name listed in the contract (use the LANGFUSE_BASE_URL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY env vars via bash).
3. Write the evaluation report to: \`${outputPath}\`
4. After writing, use the \`mcp\` tool to call \`mempalace_add_drawer\` with:
   - wing: infer from project directory name (e.g. "project-kai")
   - room: "Research"
   - title: "Evaluation: ${threadId}"
   - content: summary of predicted vs actual (3–5 sentences)
   - tags: ["evaluation", "measurement", "${threadId}"]

The evaluation report should be honest about where predictions were wrong and why.`.trim();
}
