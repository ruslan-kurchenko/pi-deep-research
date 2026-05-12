# pi-deep-research MVP Implementation Plan

> **For Claude/Codex/Pi:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (or `subagent-driven-development` for in-session execution) to implement this plan task-by-task.

**Goal:** Build a Pi extension that turns "go research X" into a repeatable pipeline producing committable ADR / RFC / Design Doc / PRD artifacts with predicted KPIs and a post-implementation evaluation loop.

**Architecture:** Single Pi extension (`pi-deep-research`) registers 12 `/research:*` commands and a state machine over a per-topic artifact tree (`research/NNN-slug/` gitignored; `docs/{adrs,rfcs,design-docs,prds,measurement,evaluation}/NNN-slug.md` committed). Heavy lifting is delegated to existing extensions: `pi-subagents` for parallel scouts, `pi-mcp-adapter` for MemPalace + Exa + Context7 + Linear MCPs, `pi-librarian` for GitHub recon. The extension owns the workflow, templates, state, MemPalace integration, alternatives matrix, and measurement adapter.

**Tech Stack:**
- TypeScript, Node ≥ 20
- Pi extension API (`@earendil-works/pi-coding-agent`)
- Schema: `typebox`
- Test: `vitest`
- Templates: plain markdown with `{{placeholders}}` (no Handlebars dep — keep it light)
- Diagrams: Mermaid + C4 via Mermaid
- Confidence: `meta-cognitive` PAI skill (invoked via subagent prompt)
- Doc style: mattpocock-skills (`to-prd`, `ubiquitous-language`, `request-refactor-plan`)

---

## Non-Goals (MVP)

- No web UI / dashboard. Markdown + TUI only.
- No automatic execution of the research → measurement adapters other than `langfuse` (read-only) and `manual`.
- No multi-repo research (one project at a time).
- No fine-tuning of scout prompts at runtime (templates are static, edit-then-`/reload`).
- No vector store / embeddings — MemPalace handles semantic recall via MCP.

---

## Critical Decisions Locked

| Decision | Value | Why |
|---|---|---|
| Repo location | `~/Projects/personal/pi-deep-research/` (standalone) | Generic Pi extension, publishable to npm |
| Package name | `pi-deep-research` | Operator-confirmed |
| Command prefix | `/research:*` | Operator-confirmed |
| Memory backend | MemPalace via `pi-mcp-adapter` | Existing infra at `http://100.67.90.25:8080/mcp` |
| Web search | Exa MCP (via `pi-mcp-adapter`) primary; `pi-web-access` optional for video | Already in operator's MCP config |
| Vendor docs | Context7 MCP | Existing in operator's MCP config |
| GitHub recon | `pi-librarian` | Sharper than generic Exa |
| Subagent runtime | `pi-subagents` (npm) | Better than shipped example |
| Doc formats | ADR / RFC / Design Doc / PRD (hierarchical) | Operator-specified |
| Diagrams | Mermaid + C4-via-Mermaid | Operator-specified |
| Alternatives | 1–5, always include "do nothing" | Operator-specified |
| Confidence scoring | `meta-cognitive` 5-step pattern | Operator-specified |
| Approval | Solo operator + cross-check subagents (`challenger`, `devils-advocate`) | Operator-specified |
| Measurement adapters | `langfuse` + `manual` for MVP | Operator-confirmed |
| Artifact persistence | `research/NNN-slug/` gitignored; `docs/{...}/NNN-slug.md` committed | Operator-specified |

---

## Artifact Tree

```
<project-root>/
├── research/                          # GITIGNORED by default (extension adds .gitignore on init)
│   └── NNN-slug/
│       ├── brief.md                   # scope + grilled requirements
│       ├── rubric.md                  # scoring dimensions
│       ├── raw/
│       │   ├── web-001-<query>.md
│       │   ├── oss-001-<repo>.md
│       │   ├── vendor-001-<sdk>.md
│       │   ├── repo-001-<path>.md
│       │   └── memory-001-<wing>.md
│       ├── synthesis.md               # meta-cognitive synthesis w/ confidence
│       ├── alternatives.md            # ranked matrix incl. "do nothing"
│       └── cross-checks/
│           ├── challenger.md
│           └── devils-advocate.md
└── docs/                              # COMMITTED
    ├── decisions/adrs/NNN-slug.md
    ├── rfcs/NNN-slug.md
    ├── design-docs/NNN-slug.md
    ├── prds/NNN-slug.md
    ├── measurement/NNN-slug.md
    └── evaluation/NNN-slug.md
```

`NNN` is zero-padded auto-increment from the highest existing index across all dirs. `slug` is kebab-cased from the topic.

---

## State Model

One research thread = one folder under `research/NNN-slug/`. State is reconstructed from the file system at extension load (and on `/research:status`). No hidden state. The extension also writes a `.state.json` per thread with the current phase:

```json
{
  "id": "001-vapi-vs-direct-twilio",
  "topic": "VAPI vs direct Twilio voice stack",
  "scope": ["architecture", "nfr"],
  "phase": "groom",
  "createdAt": "2026-05-12T16:30:00Z",
  "linkedDocs": {
    "rfc": "docs/rfcs/001-voice-stack-redesign.md",
    "measurement": "docs/measurement/001-voice-stack-redesign.md"
  }
}
```

**Phases:** `brief → scout → groom → alternatives → docs → contract → evaluate → closed`.
Transitions are append-only (phase can advance; never auto-rewind).

---

## Command Surface (final)

| Command | Phase entered | Reads | Writes |
|---|---|---|---|
| `/research:new <topic>` | `brief` | MemPalace context | `research/NNN-slug/brief.md`, `.state.json` |
| `/research:scout` | `scout` | `brief.md` | `research/NNN-slug/raw/*.md` |
| `/research:groom` | `groom` | `raw/*.md`, MemPalace | `synthesis.md` |
| `/research:alternatives` | `alternatives` | `synthesis.md`, `rubric.md` | `alternatives.md`, `cross-checks/*.md` |
| `/research:adr <name>` | `docs` | `alternatives.md` | `docs/decisions/adrs/NNN-slug.md` |
| `/research:rfc` | `docs` | `alternatives.md` | `docs/rfcs/NNN-slug.md` |
| `/research:design-doc` | `docs` | `alternatives.md` | `docs/design-docs/NNN-slug.md` |
| `/research:prd` | `docs` | linked ADR/RFC/Design Doc | `docs/prds/NNN-slug.md` |
| `/research:contract` | `contract` | linked design doc | `docs/measurement/NNN-slug.md` |
| `/research:evaluate` | `evaluate` | measurement contract + adapter | `docs/evaluation/NNN-slug.md`, MemPalace drawer |
| `/research:status` | — | `.state.json` (all threads) | TUI render only |
| `/research:resume <NNN>` | — | `.state.json` | switches active thread |

Implicit rules:
- Each command verifies the prior phase exists. Fails with a clear next-step hint if not.
- Operator can re-run any phase (overwrites with confirmation).
- The "active thread" is the most recently created/resumed. Stored in `~/.pi/agent/state/pi-deep-research-active.json`.

---

## Subagent Crew

All agents are pi-subagents profile files installed by the extension at `~/.pi/agent/agents/research-*.md`. They are scoped (only loadable inside a `/research:*` command).

| Agent | Tools | Model preference | Job |
|---|---|---|---|
| `research-web-scout` | `mcp` (exa, context7), `read` | sonnet | Web/blog/talks/vendor-doc recon |
| `research-oss-scout` | `librarian` tool | sonnet | GitHub code recon via `pi-librarian` |
| `research-repo-scout` | `read`, `grep`, `find`, `ls` | sonnet | Codebase grounding (current architecture) |
| `research-memory-scout` | `mcp` (mempalace) | haiku | Prior decisions + stack prefs from MemPalace |
| `research-synthesizer` | `read` | opus or sonnet:high | Meta-cognitive synthesis w/ confidence |
| `research-architect` | `read` | sonnet | C4 diagram generation |
| `research-challenger` | `read` | sonnet | "What's wrong with this proposal" |
| `research-devils-advocate` | `read` | sonnet | "Why does 'do nothing' win" |
| `research-kpi-architect` | `read`, `mcp` (context7) | sonnet | Predicted KPI ranges + measurement plan |

---

## Phased Plan

Three phases. **Operator review checkpoint at the end of each phase.** Pilot the KAI North Star research (VAPI / model / dead-air) at the end of Phase 2 and again at end of Phase 3.

### Phase 0: Bootstrap (Tasks B1–B5)

**Acceptance:** `pi -e ./src/index.ts` loads the extension. `/research:hello` (placeholder) responds. CI runs vitest. No real commands yet.

**Tasks:**

- **B1.** Initialize `package.json` (Pi extension layout, vitest, biome, typescript). `pi` field declares the extension entry.
- **B2.** `tsconfig.json`, `biome.json`, `.editorconfig`.
- **B3.** `src/index.ts` skeleton with one `/research:hello` command that prints "pi-deep-research alive".
- **B4.** `tests/extension.smoke.test.ts` that loads the extension factory and asserts it registers the `hello` command.
- **B5.** First commit: `chore: bootstrap pi-deep-research package`.

### Phase 1: Skeleton + First Scout Flow (Tasks 1–10)

**Acceptance:**
- `/research:new "vapi vs direct twilio"` creates `research/001-vapi-vs-direct-twilio/brief.md` and `.state.json`.
- Interactive grill-me-style prompt fills 5–7 questions in the brief.
- `/research:scout` dispatches 4 parallel scouts (web, oss, repo, memory). Each writes a `raw/*.md`.
- `/research:status` shows the active thread + phase.
- MemPalace adapter reads the project wing and produces `memory-001-*.md`.

**Tasks:**

- **1.** `src/lib/paths.ts` — resolve `<project-root>/research/`, slug, NNN auto-increment. Tests: edge cases (no folder, gaps in numbering, slug collisions).
- **2.** `src/state/store.ts` — read/write `.state.json` per thread + global active-thread pointer at `~/.pi/agent/state/pi-deep-research-active.json`. Tests: round-trip, concurrent-thread isolation.
- **3.** `src/state/tracker.ts` — phase machine (`brief → scout → groom → ...`), only advances. Tests: legal/illegal transitions.
- **4.** `src/mempalace/client.ts` — thin wrapper that locates the `pi-mcp-adapter` proxy tool at runtime and calls `mempalace_search` + `mempalace_add_drawer`. Tests: mocked MCP proxy.
- **5.** `src/lib/grill.ts` — Socratic prompt builder (loads from `templates/prompts/grill-brief.md`). Tests: template interpolation.
- **6.** `src/commands/new.ts` — `/research:new` command. Uses `ctx.ui.input` for grill-me interview. MemPalace lookup. Writes `brief.md`.
- **7.** `src/scouts/base.ts` — shared scout dispatch helper. Wraps `pi-subagents` `subagent` tool with our agent names. Tests: ensure prompt + tool-allowlist sent correctly.
- **8.** `src/scouts/{web,oss,repo,memory}.ts` — four scout modules. Each owns its prompt template + output path.
- **9.** `src/commands/scout.ts` — `/research:scout` command. Parallel dispatch + writes `raw/*.md` + advances phase.
- **10.** `src/commands/status.ts` + `src/commands/resume.ts` — read all `.state.json`, render TUI table.

**Pilot at end of Phase 1:** Run `/research:new "voice stack north star: vapi, model, dead-air"` and `/research:scout`. Inspect `research/001-voice-stack-north-star/`. **Stop. Operator review.** Decide whether the dossier shape is actually useful before building Phase 2.

### Phase 2: Synthesis + Grooming (Tasks 11–17)

**Acceptance:**
- `/research:groom` runs an interactive grill on the operator anchored on `raw/*.md`. Synthesizer subagent produces `synthesis.md` with per-claim confidence (0.0–1.0) and explicit caveats.
- `/research:alternatives` produces `alternatives.md` with 1–5 options + "do nothing", scored against a per-research rubric.
- `challenger` and `devils-advocate` subagents review the alternatives and write to `cross-checks/*.md`.

**Tasks:**

- **11.** `src/synthesis/synthesizer.ts` — dispatches `research-synthesizer` agent with meta-cognitive 5-step pattern in the system prompt. Tests: prompt construction.
- **12.** `templates/prompts/synthesizer.md` — system prompt enforcing decompose / solve+confidence / verify / synthesize / reflect.
- **13.** `src/commands/groom.ts` — interactive loop using `ctx.ui.input` + `ctx.ui.confirm`. Updates `synthesis.md` in place.
- **14.** `src/synthesis/rubric.ts` — either loads existing `rubric.md` or asks the operator to define dimensions (latency, cost, ops burden, etc.) with weights. Tests: rubric parsing.
- **15.** `src/synthesis/alternatives.ts` — given `synthesis.md` + `rubric.md`, drives a subagent to produce `alternatives.md` with a markdown comparison table.
- **16.** `src/synthesis/cross-check.ts` — fires `challenger` + `devils-advocate` in parallel against `alternatives.md`.
- **17.** `src/commands/alternatives.ts` — wires 14+15+16. Operator confirms the ranking before phase advance.

**Pilot at end of Phase 2:** Continue the KAI North Star research. Run `/research:groom`, `/research:alternatives`. **Stop. Operator review.** Verify the alternatives matrix is something you'd actually present to your team.

### Phase 3: Documents + Measurement (Tasks 18–28)

**Acceptance:**
- Four doc commands produce committable artifacts under `docs/{adrs,rfcs,design-docs,prds}/`.
- C4 context + container diagrams (Mermaid) generated in design docs.
- `/research:contract` writes measurement contract with predicted KPI ranges.
- `/research:evaluate` reads the contract, calls the adapter (langfuse or manual), writes `docs/evaluation/NNN.md`, and persists a drawer in MemPalace project wing.

**Tasks:**

- **18.** `src/docs/render.ts` — generic markdown template renderer (`{{placeholder}}` substitution; no Handlebars). Tests: nested placeholders, missing keys.
- **19.** `templates/adr.md`, `templates/rfc.md`, `templates/design-doc.md`, `templates/prd.md`, `templates/measurement.md`, `templates/evaluation.md` — mattpocock-style templates.
- **20.** `src/docs/adr.ts` + `src/commands/adr.ts` — produce single-decision ADR from alternatives ranking. Operator picks which alternatives become ADRs.
- **21.** `src/docs/rfc.ts` + `src/commands/rfc.ts` — multi-decision RFC referencing ADRs.
- **22.** `src/docs/c4.ts` — drives `research-architect` agent to produce Mermaid C4 context + container diagrams. Tests: parses agent output for valid Mermaid blocks.
- **23.** `src/docs/design-doc.ts` + `src/commands/design-doc.ts` — big-scope design doc with C4 sections injected.
- **24.** `src/docs/prd.ts` + `src/commands/prd.ts` — PRD referencing one design doc + N ADRs + measurement contract.
- **25.** `src/measurement/adapter.ts` — interface: `predict(synthesis) → KPIs`, `measure(contract) → results`, `report(contract, results) → delta`.
- **26.** `src/measurement/manual.ts` — adapter that stubs the report with `TODO: fill from <source>`. Always succeeds.
- **27.** `src/measurement/langfuse.ts` — adapter that queries Langfuse traces/scores via `LANGFUSE_BASE_URL` + `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` env. Configurable score names + trace filters.
- **28.** `src/commands/contract.ts` + `src/commands/evaluate.ts` — wire 25–27. On evaluate completion, write MemPalace drawer in project wing with predicted vs. actual.

**Pilot at end of Phase 3:** Produce the KAI North Star RFC + Design Doc + measurement contract. **Stop. Operator review.** This is the real first output.

---

## Repository Layout (target after Phase 3)

```
pi-deep-research/
├── package.json
├── tsconfig.json
├── biome.json
├── README.md
├── CHANGELOG.md
├── LICENSE
├── docs/
│   ├── plans/
│   │   └── 2026-05-12-pi-deep-research-mvp.md  (this file)
│   └── ARCHITECTURE.md
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── new.ts
│   │   ├── scout.ts
│   │   ├── groom.ts
│   │   ├── alternatives.ts
│   │   ├── adr.ts
│   │   ├── rfc.ts
│   │   ├── design-doc.ts
│   │   ├── prd.ts
│   │   ├── contract.ts
│   │   ├── evaluate.ts
│   │   ├── status.ts
│   │   └── resume.ts
│   ├── scouts/
│   │   ├── base.ts
│   │   ├── web.ts
│   │   ├── oss.ts
│   │   ├── repo.ts
│   │   └── memory.ts
│   ├── synthesis/
│   │   ├── synthesizer.ts
│   │   ├── rubric.ts
│   │   ├── alternatives.ts
│   │   └── cross-check.ts
│   ├── docs/
│   │   ├── render.ts
│   │   ├── adr.ts
│   │   ├── rfc.ts
│   │   ├── design-doc.ts
│   │   ├── prd.ts
│   │   └── c4.ts
│   ├── measurement/
│   │   ├── adapter.ts
│   │   ├── manual.ts
│   │   └── langfuse.ts
│   ├── mempalace/
│   │   └── client.ts
│   ├── state/
│   │   ├── store.ts
│   │   └── tracker.ts
│   └── lib/
│       ├── paths.ts
│       ├── slug.ts
│       └── grill.ts
├── templates/
│   ├── adr.md
│   ├── rfc.md
│   ├── design-doc.md
│   ├── prd.md
│   ├── measurement.md
│   ├── evaluation.md
│   └── prompts/
│       ├── grill-brief.md
│       ├── scout-web.md
│       ├── scout-oss.md
│       ├── scout-repo.md
│       ├── scout-memory.md
│       ├── synthesizer.md
│       ├── challenger.md
│       ├── devils-advocate.md
│       └── kpi-architect.md
├── agents/                            # Installed to ~/.pi/agent/agents/ by user
│   ├── research-web-scout.md
│   ├── research-oss-scout.md
│   ├── research-repo-scout.md
│   ├── research-memory-scout.md
│   ├── research-synthesizer.md
│   ├── research-architect.md
│   ├── research-challenger.md
│   ├── research-devils-advocate.md
│   └── research-kpi-architect.md
└── tests/
    ├── extension.smoke.test.ts
    ├── lib/paths.test.ts
    ├── state/store.test.ts
    ├── state/tracker.test.ts
    ├── mempalace/client.test.ts
    ├── docs/render.test.ts
    └── measurement/adapter.test.ts
```

---

## Test Strategy

| Where | Strategy |
|---|---|
| `lib/`, `state/`, `docs/render.ts`, `mempalace/client.ts` | Unit tests with vitest. Heavy. These are the load-bearing modules. |
| Scout dispatch + subagent prompts | Snapshot tests on the prompt string. No live LLM calls in CI. |
| Commands | Integration test that loads the extension factory and asserts side effects on a temp dir. |
| Templates | Validation test: every placeholder has a fixture in `tests/fixtures/`. |
| MemPalace integration | Two-tier: unit (mocked MCP proxy) + manual smoke test against operator's home-lab server documented in README. Not in CI. |
| Langfuse adapter | Unit tests against recorded HTTP fixtures. Live integration test runs locally only with env vars. |

**Coverage target:** ≥ 80 % on `src/lib`, `src/state`, `src/docs`. Other paths covered by integration smoke tests.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scout output is verbose noise instead of synthesized signal | Aggressive prompts: every scout must return a Markdown doc with `## Findings` (numbered, claim+source+confidence) and `## Skip-list` (what it deliberately ignored). Synthesizer is told to prefer high-confidence claims and call out missing evidence. |
| `pi-subagents` API drift (it's young) | Pin a specific version. Wrap behind `src/scouts/base.ts`. Tests cover our usage of the wrapper. |
| MemPalace MCP tool names change | Single adapter at `src/mempalace/client.ts`. All tool names live in one place. |
| Template drift between docs/ outputs | Templates live in `templates/` and are tested with fixtures. Renderer fails loudly on missing keys. |
| Pi-mcp-adapter requires user-side config | README ships an exact `.mcp.json` snippet derived from the operator's `~/.config/pai/opencode.json`. `/research:doctor` (post-MVP) will validate. |
| C4 diagrams come out malformed | Architect agent prompt includes a strict Mermaid C4 schema; renderer validates the fenced block parses before writing. |
| Langfuse API changes / score names mismatch | Adapter takes score names from `docs/measurement/NNN.md` (per-research config), not hardcoded. |

---

## Out of Scope for MVP (Phase 4+ candidates)

- `/research:doctor` — environment validator (MCPs reachable, deps installed, templates present).
- Datadog / Honeycomb / OTel measurement adapters.
- Cross-thread synthesis (`/research:meta` — combine multiple closed threads into one mega-doc).
- Auto-publishing PRDs to Linear via the Linear MCP.
- Slack/Discord delivery of finalized docs.
- Voice-mode delivery (lol).

---

## Operator Checkpoints

1. **After this plan.** Operator approves the plan or requests changes. **No code is written until approval.**
2. **End of Phase 0.** Smoke test that the extension loads.
3. **End of Phase 1.** Pilot the KAI North Star research scout phase. Inspect dossier. Decide go/no-go on Phase 2.
4. **End of Phase 2.** Inspect alternatives matrix on KAI North Star. Decide go/no-go on Phase 3.
5. **End of Phase 3.** Produce the real KAI North Star RFC + Design Doc + measurement contract. The pilot becomes the first real artifact.

---

## Execution Handoff (when plan is approved)

Two options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task with code review between tasks. Fast iteration, you watch.
2. **Parallel Session (separate)** — Open a new Pi session in the repo with `superpowers:executing-plans`. Batch execution with explicit checkpoints. Better if you want to step away.

Operator picks at the next checkpoint.
