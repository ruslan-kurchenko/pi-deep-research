# Plan: Per-Agent Model Selection + Oracle Subagent

**Date:** 2026-05-13
**Status:** Approved (pending operator final review)
**Author:** Walle + Ruslan
**Predecessor:** `2026-05-12-pi-deep-research-mvp.md` (Phases 0–3 shipped)

---

## Goals

1. **Cost-aware model dispatch.** Stop running Opus 4.7 on every subagent. Per-agent defaults; some Haiku 4.5, some Sonnet 4 (1M), one Gemini, one OpenAI.
2. **Model diversity for review.** Cross-checks run on Gemini (different family than Claude scouts). Oracle runs on OpenAI (third family).
3. **Add `research-oracle` subagent.** Gates `/research:alternatives` output and heavyweight doc commands (`rfc`, `design-doc`, `prd`). Skips ADRs.
4. **Project-level model override.** `.pi/deep-research/models.json` so teams can tune per-repo without touching agent files.
5. **Model traceability.** Every output file records the model used, and `.state.json` keeps an audit log.

---

## Non-goals (this iteration)

- Cost telemetry / budget caps
- Quality A/B harness comparing model outputs
- Automatic model selection (smart routing based on task complexity)
- Global (`~/.pi/deep-research/models.json`) override layer
- Per-thread model pinning (use the project file or agent defaults — that's enough)

---

## Architecture: three-tier model diversity

```
Scouts          (Anthropic — Haiku/Sonnet)
   ↓
Synthesizer     (Anthropic — Sonnet 4 1M)
   ↓
Alternatives matrix
   ↓
Cross-checks    (Google — Gemini 2.5/3.x Pro)   ← different family
   ↓
Oracle gate (iii)  (OpenAI — GPT-5 / o3)         ← third family, advisory
   ↓
Operator review (Walle synthesizes oracle output, talks to operator)
   ↓
Documents (ADR / RFC / Design Doc / PRD)
   ↓
Oracle gate (iv) on heavy docs only             ← same OpenAI oracle
   ↓
Operator review
   ↓
Measurement contract → Evaluation
```

**Three families, three roles.** Each tier catches different blindspots than the previous.

---

## Model assignments (locked)

| Agent | Default model | Rationale |
|---|---|---|
| `research-memory-scout` | `anthropic/claude-haiku-4.5` | MCP queries + summary, trivial |
| `research-web-scout` | `anthropic/claude-haiku-4.5` | Fetch + extract, pattern matching |
| `research-repo-scout` | `anthropic/claude-sonnet-4-1m` | Reads code, follows refs |
| `research-oss-scout` | `anthropic/claude-sonnet-4-1m` | Comparative reasoning |
| `research-synthesizer` | `anthropic/claude-sonnet-4-1m` | Multi-source synthesis + meta-cognitive |
| `research-challenger` | `google/gemini-2.5-pro` | Cross-family contrarian |
| `research-devils-advocate` | `google/gemini-2.5-pro` | Cross-family status-quo defender |
| `research-doc-advisor` | `anthropic/claude-haiku-4.5` | Format classifier, cheap |
| `research-kpi-architect` | `anthropic/claude-sonnet-4-1m` | Metric design reasoning |
| `research-architect` (C4) | `anthropic/claude-sonnet-4-1m` | Architectural reasoning |
| **`research-oracle`** (new) | `openai/gpt-5` (or `o3`) | SOTA reasoning, cross-family review |

**Exact model IDs verified at install time.** Pi tracks the live list per-release; if `gpt-5` becomes `gpt-5.1` we update the default in one place (`agents/research-oracle.md`).

---

## Subscription auth setup (one-time, operator)

```
/login → ChatGPT Plus/Pro (Codex)     # required for oracle
/login → Claude Pro/Max               # already done
/login → GitHub Copilot               # optional; also provides Gemini

# Gemini API key (no subscription path)
export GEMINI_API_KEY=...              # free tier from Google AI Studio
```

Documented in `docs/SETUP.md` as a prerequisites section.

---

## Config schema: `.pi/deep-research/models.json`

```jsonc
{
  // Per-agent override of defaults baked into agent profiles.
  // Only listed agents are overridden; others fall back to profile default.
  "agents": {
    "research-web-scout": "anthropic/claude-haiku-4.5",
    "research-oracle": "openai/gpt-5",
    "research-challenger": "google/gemini-2.5-pro"
  }
}
```

**Resolution order** (later overrides earlier):

1. Hardcoded fallback (Sonnet 4) — never reached in healthy setup
2. Agent profile frontmatter (`agents/research-*.md` YAML header)
3. Project file (`.pi/deep-research/models.json`)

**No env-var layer, no global file, no per-thread override.** Two layers is enough.

**File is committed**, not gitignored. Team consensus on model choices belongs in source control.

---

## Fallback policy (per Q5: option C)

When a configured model's provider isn't authed:

```
WARNING: research-challenger configured for google/gemini-2.5-pro,
         but GEMINI_API_KEY is not set and no Google subscription
         is authed.

         Proceed with anthropic/claude-sonnet-4-1m as fallback? (y/n)
         (Note: cross-family diversity is lost.)
```

- Resolved at command-invocation time, not at extension load
- Operator answer cached in thread state (`.state.json`) so the prompt doesn't repeat mid-thread
- Fallback chain: requested → Sonnet 4 (1M) → Sonnet 4 standard → Opus 4
- The fallback is recorded in `model_used` frontmatter so traces stay honest

---

## Oracle subagent spec

### Trigger points

| Gate | Command | Mandatory? |
|---|---|---|
| (iii) After alternatives | end of `/research:alternatives` | **Yes, mandatory** |
| (iv) After heavyweight doc | end of `/research:rfc`, `/research:design-doc`, `/research:prd` | **Yes, mandatory for these three** |
| Manual | `/research:oracle` callable anytime | Opt-in |

ADRs (`/research:adr`) **skip oracle by design** — they're intentionally single-decision and small.

### Agent profile

`agents/research-oracle.md` — built fresh, not adapted from another profile. Key elements:

- Model: `openai/gpt-5` (default; configurable via project file)
- Skills: `meta-cognitive` (loaded at invocation)
- System prompt: hardcoded SOTA review instructions (NOT just relying on the skill)
- Output schema: mandatory, enforced via "if you cannot fill a section, write 'NONE FOUND'"

### Mandatory output schema

```markdown
# Oracle Review — <thread-id> — gate: <after-alternatives | after-doc>
## Verdict
APPROVE | REVISE | REJECT
Confidence: 0.0–1.0

## Decomposition (meta-cognitive step 1)
[Restates the problem as 3–7 sub-questions in own words. If restatement
doesn't match original intent, that's the first signal something upstream
is broken.]

## Per-claim audit
| # | Claim from upstream doc | Evidence cited | Oracle confidence | Concern |
|---|---|---|---|---|

## Concerns (ranked severity × confidence)
1. **[CRITICAL]** ...
2. **[HIGH]** ...
3. **[MEDIUM]** ...

## Missing alternatives
[Options the upstream synthesis didn't consider — explicit list]

## Hidden assumptions
[Claims treated as facts that are actually assumptions]

## Suggested actions
- [ ] Specific, actionable rewrites/investigations

## Calibration check (meta-cognitive step 5)
[If overall confidence < 0.8: which decomposition step is weakest and why]
```

### Workflow loop after oracle output

```
oracle writes to: research/<thread-id>/oracle/after-<gate>.md
   ↓
main agent (Walle) reads the review
   ↓
main agent summarizes to operator:
   - Verdict + confidence
   - Top 3 concerns
   - Suggested actions
   ↓
operator picks one of:
   (1) Accept all → main agent re-runs upstream command WITH oracle concerns
                    as additional input. Operator's explicit "go" required.
   (2) Accept some → operator says which; main agent re-runs partially
   (3) Dismiss → noted in thread state with operator's reason, proceed unchanged
   (4) Iterate → operator asks oracle a clarifying question
```

**No auto-loop.** Always wait for operator. Decision recorded in `.state.json`:

```jsonc
{
  "oracle_reviews": [
    {
      "gate": "after-alternatives",
      "verdict": "REVISE",
      "operator_decision": "accept_some",
      "accepted_concerns": [1, 3],
      "timestamp": "2026-05-13T10:00:00Z"
    }
  ]
}
```

---

## Implementation phases

### Phase 4A — model plumbing (foundation, no oracle yet)

**Goal:** every subagent dispatch goes through model resolution. No behavior change, just observability.

#### 4A.1 — agent-profile frontmatter

Update all 10 agent files in `agents/research-*.md` to include `model:` in the frontmatter. Example:

```markdown
---
name: research-web-scout
description: ...
model: anthropic/claude-haiku-4.5
---
```

#### 4A.2 — config loader

New module `src/config/models.ts`:

```typescript
export interface ModelsConfig {
  agents: Record<string, string>;
}

export async function loadModelsConfig(projectRoot: string): Promise<ModelsConfig>;
export async function resolveAgentModel(
  agentName: string,
  projectRoot: string,
  agentDefaults: Record<string, string>
): Promise<string>;
```

Loads `.pi/deep-research/models.json` if present. Falls back to agent profile defaults. Returns the model string to pass to `subagent`.

#### 4A.3 — provider availability check

New module `src/config/providers.ts`:

```typescript
export interface ProviderStatus {
  configured: boolean;
  reason?: string;  // e.g. "GEMINI_API_KEY not set"
}

export async function checkProvider(modelId: string): Promise<ProviderStatus>;
```

Reads `~/.pi/agent/auth.json` and environment. Used by fallback prompt.

#### 4A.4 — fallback resolution

New module `src/config/fallback.ts`:

```typescript
export async function resolveWithFallback(
  requestedModel: string,
  ctx: ExtensionCommandContext,
  threadId: string,
  projectRoot: string
): Promise<string>;
```

If provider not configured, prompts operator (option C from Q5). Records decision in thread state.

#### 4A.5 — wire into all instruction builders

Every command that builds a subagent task injects the resolved model into the instruction:

```
Use the `subagent` tool with model "anthropic/claude-haiku-4.5" to dispatch...
```

The LLM passes that string in the subagent call's `model` field.

#### 4A.6 — frontmatter on outputs

Update scout, synthesis, alternatives, cross-check, and doc outputs to start with:

```yaml
---
agent: research-web-scout
model: anthropic/claude-haiku-4.5
generated_at: 2026-05-13T10:00:00Z
thread_id: 001-...
---
```

Operator and Walle can grep this later to A/B compare models.

#### 4A.7 — state audit log

Extend `.state.json`:

```jsonc
{
  ...,
  "model_usage": [
    {
      "agent": "research-web-scout",
      "model": "anthropic/claude-haiku-4.5",
      "command": "scout",
      "timestamp": "..."
    }
  ]
}
```

#### 4A.8 — tests

- `tests/config/models.test.ts` — load, override resolution, fallback chain
- `tests/config/providers.test.ts` — auth.json parsing, env var detection
- Update existing instruction-builder tests to assert model string presence

**Stop here for operator review.** Phase 4A is the foundation; Phase 4B adds the oracle on top.

---

### Phase 4B — oracle subagent

#### 4B.1 — agent profile

`agents/research-oracle.md`:

- Hardcoded SOTA system prompt (oracle role, schema, mandatory sections)
- `model: openai/gpt-5`
- `skills: meta-cognitive`
- References meta-cognitive 5-step pattern explicitly in the prompt

#### 4B.2 — oracle prompt template

`templates/prompts/oracle.md`:

- Inputs: brief, synthesis, alternatives (for gate iii) OR brief + final doc (for gate iv)
- Output: the mandatory schema
- Instructions to write to `research/<thread>/oracle/after-<gate>.md`

#### 4B.3 — `/research:oracle` standalone command

`src/commands/oracle.ts` — invokable at any phase. Takes an optional gate name argument; defaults to current phase.

#### 4B.4 — auto-invocation at gates (iii) and (iv)

- `runAlternatives` appends an oracle phase to its instruction after writing `alternatives.md`
- `runRfc`, `runDesignDoc`, `runPrd` each append oracle invocation after writing their doc
- `runAdr` does NOT — skipped by design

#### 4B.5 — operator review flow

After oracle writes its output:

- Main agent (Walle) reads the file
- Summarizes to operator: verdict, top 3 concerns, suggested actions
- Asks operator to pick: accept all / accept some / dismiss / iterate
- Records decision in `.state.json` `oracle_reviews` array

#### 4B.6 — re-run paths

If operator picks "accept all" or "accept some":

- Walle re-runs the relevant command (`/research:alternatives` or the doc command) with the oracle's accepted concerns appended to the brief
- Re-run is gated on operator explicit confirmation ("Re-run alternatives with these 3 concerns? y/n")

#### 4B.7 — tests

- Oracle instruction builder produces correct schema reminders
- Workflow state transitions on operator decisions
- Re-run path preserves prior context (doesn't lose synthesis)

**Stop here for operator review.** Phase 4B is the heaviest behavior change; verify before Phase 4C.

---

### Phase 4C — polish

- `docs/SETUP.md` updated: subscription auth steps + Gemini key setup
- `README.md` updated: model diversity architecture diagram
- `.pi/deep-research/models.json.example` checked in
- Default `.pi/deep-research/models.json` generated by `/research:new` if missing
- End-to-end test on the synthetic pilot topic (bun vs node vs deno) to verify all model strings actually dispatch correctly

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GPT-5 model ID changes in pi release | Medium | Low | Single-source default in agent profile; one-line update |
| Gemini API free tier exhausted | Medium | Medium | Fallback to Sonnet 4 (1M) per Q5; operator notified |
| Oracle gives confidently wrong reviews | Medium | High | Operator always in the loop (no auto-loop); track oracle accuracy informally in MemPalace |
| Cross-family models disagree on every alternative | Low | Medium | This is the *point*. Operator adjudicates. |
| Subagent extension model param ignored by some providers | Low | Medium | Verify in Phase 4A.8 tests; document workarounds |

---

## Acceptance criteria

- [ ] All 10 existing agent profiles have `model:` in frontmatter
- [ ] `.pi/deep-research/models.json` schema documented + example committed
- [ ] Every subagent dispatch reads resolved model and passes it through
- [ ] Every output file has model-usage frontmatter
- [ ] `.state.json` carries a `model_usage` audit log
- [ ] Fallback prompt fires when provider not configured (manually tested)
- [ ] `research-oracle` agent profile written with SOTA prompt
- [ ] `/research:oracle` standalone command works
- [ ] Auto-invocation works after `/research:alternatives`
- [ ] Auto-invocation works after `/research:rfc`, `design-doc`, `prd`
- [ ] `/research:adr` does NOT invoke oracle
- [ ] Operator review loop records decisions in `.state.json`
- [ ] End-to-end test on synthetic pilot passes
- [ ] Tests for `config/models.ts`, `config/providers.ts`, `config/fallback.ts`

---

## Open questions (none at writing — re-grill if any emerge mid-implementation)

If during implementation we hit something not covered above, stop and ask. No silent guesses on model strings, no silent fallbacks, no silent skips of oracle gates.
