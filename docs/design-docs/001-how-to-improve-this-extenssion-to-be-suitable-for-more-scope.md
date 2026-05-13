# Design Doc: Making pi-deep-research General-Purpose and Extensible

**Date:** 2026-05-13
**Status:** Draft (oracle pass 6 — all 12 pass-5 actions resolved holistically)
**Authors:** Ruslan Kurchenko
**Research thread:** 001-how-to-improve-this-extenssion-to-be-suitable-for-more-scope

> **Oracle history:**
> - Pass 1: REVISE (0.86) — ScoutDefinition under-specified, MemPalace scope incomplete, model-ID split-brain
> - Pass 2: REVISE (0.86) — ScoutDefinition manifest/code ambiguity, dispatchModelId() voodoo, default-scout policy missing, canRunCommand() needed
> - Pass 3: REVISE (0.86) — ScoutDefinition straddled static/executable; under-specified loading; canRunCommand() under-modeled; memory-optional too narrow
> - Pass 4: REVISE (0.88) — Scout loading conflates import/probe; no API version; config.scouts[] syntax undefined; providerFromModel() unknown fallback permissive; Bug C gate manual; Bug B/E acceptance vague; canRunCommand() state examples missing; doctor lacks --json
> - **Post-pass-3 implementation** (already in code, 97/97 tests green): Bugs G (native IDs everywhere + providerFromModel() prefix inference), H (alternatives optional), J (project-scoped active.json) all fixed.
> - **Pass 5**: REVISE (0.90) — providerFromModel() cast lies; Stage 1 timing contradicts lazy config; canRunCommand() table doesn't encode examples; release gate contains its prerequisites; env-vars-only plugin config not reusable; doctor doesn't cover scout declarations
> - **Pass 6** (this version): all root tensions resolved holistically — (a) ALL init moved to first-command, eliminating Stage 1 vs lazy-config contradiction; (b) `KNOWN_PROVIDERS` set validates slash prefixes (no lying casts); (c) `canRunCommand()` uses `customCheck` callbacks so the table encodes the examples directly; (d) release plan restructured — Layer 2 has all bug fixes including helpers, Layer 3 builds the plugin surface on top; (e) object-form `scouts[]` entries support plugin-specific config; (f) doctor probes every ScoutDefinition declaration and scopes credential checks to configured providers; (g) Stage 2 returns rich `AvailabilityResult`; (h) compiled `.js` only at runtime (no `.ts` import question); (i) explicit "Deferred to v2" section.

---

## TL;DR

`pi-deep-research` is a personal research tool hardwired for one user, one memory system, and four fixed scouts. Three ordered layers make it general-purpose: **(1)** remove personal-identity coupling and make all external services optional, **(2)** fix nine concrete bugs including a provider-check split-brain, **(3)** introduce a `ScoutDefinition` trusted plugin module contract. Scouts are executable TypeScript modules loaded from the operator's own machine — the trust boundary is already the operator — with explicit declaration that plugins run local code. The oracle's pass-2 critical finding (manifest vs executable ambiguity) is resolved by committing to the executable model and documenting the trust model.

---

## Goals

1. Any user can run the extension without forking — no hardcoded personal identity, no private infrastructure URLs.
2. Scouts are pluggable via a **stable, versioned, executable TS module contract** — users implement `ScoutDefinition` and load it via `config.scouts`.
3. Memory integration is optional end-to-end — MemPalace participates in **zero phases** unless `mempalaceUrl` is configured; default scout roster is `[web, oss, repo]`.
4. External dependencies fail loudly and early via `/research:doctor` with `--quick` and `--deep` modes.
5. Config is validated at extension load via TypeBox schema with exact file locations, env var names, and merge semantics.
6. All nine known bugs are fixed before any new capability ships — enforced by a release gate.

---

## Non-goals

- Full DAG/YAML workflow orchestration — overkill at ~1K LoC.
- Stage ABCs (STORM-style) — premature.
- Plugin registry server or npm ecosystem — wait for API to stabilise.
- Plugin sandboxing / security scanning — out of scope for a developer tool.
- Marketplace / paid distribution.
- Non-pi agent runtimes (LangGraph, VS Code Copilot).
- Privacy/redaction controls — deferred to a later design.

---

## Background

`pi-deep-research` registers 14 `/research:*` CLI commands orchestrating: `brief → scout → groom → alternatives → docs → contract → evaluate → closed`. Four specialist scouts (web, OSS, repo, memory) run in parallel. A synthesizer, oracle, and doc-generation agents handle downstream phases.

The extension cannot be adopted by others because of coupling across four categories (confirmed by a live `rg` scan — see §Hardcoded-assumption inventory):

- **Personal identity:** `"Ruslan Kurchenko"` hardcoded in `src/docs/instructions.ts` ×4.
- **Private infrastructure:** MemPalace assumed always present in scout dispatch, grill prompt, evaluate instruction, and README.
- **Model ID split-brain (resolved):** All model IDs now use native pi format (`claude-haiku-4-5`, `gpt-5.5`, `gemini-2.5-pro`). `providerFromModel()` was updated to infer provider from name prefix rather than requiring a slash. Agent profile frontmatter updated to native IDs. `models.ts` defaults use native IDs. 97/97 tests pass.
- **Hardwired scouts:** Four scouts are hardcoded in `src/commands/scout.ts`. `src/scouts/base.ts` has `ScoutTaskSpec` but no registry.

Three OSS references consulted: `gpt-researcher` (27K ⭐, retriever registry), `stanford-oval/storm` (28K ⭐, stage ABCs), `langchain-ai/open_deep_research` (11K ⭐, typed state). Key insight: **files-in-directory with typed executable modules is the right abstraction at this scale** — not ABCs, not a registry server, not a DAG runtime.

---

## Hardcoded-assumption inventory

Live `rg` scan on 2026-05-13:

| File | Pattern | Disposition |
|---|---|---|
| `src/docs/instructions.ts:59,111,167,227` | `"Ruslan Kurchenko"` ×4 | Replace with `config.user.name` |
| `tests/docs/render.test.ts:11-12` | `"Ruslan"` fixture | Benign — keep |
| `src/commands/new.ts` | `buildMemPalaceClient` imported, unused | Wire with config guard (Bug E) |
| `agents/research-memory-scout.md` | MemPalace MCP tools | Move to `examples/memory-mempalace/`; remove from default agents |
| `templates/prompts/grill-brief.md:24` | `Prior MemPalace context` | Make generic: `Prior memory context (optional)` |
| `README.md:19` | `/research:evaluate … MemPalace` | Note evaluate MemPalace is conditional |
| `README.md:28-31` | `anthropic/claude-haiku-4.5` etc. | Document both registry format and dispatch format |
| `README.md:134` | `"research-challenger": "google/gemini-2.5-pro"` in example | Update to `gemini-2.5-pro` (native) |
| All 8 `agents/*.md:5` | `model: anthropic/...` frontmatter | **Fixed** — all updated to native IDs; installed to `~/.pi/agent/agents/` |
| `src/scouts/base.ts:5` | Comment `"e.g. anthropic/claude-haiku-4.5"` | Update comment to native format |
| `src/config/providers.ts` | `providerFromModel()` slash-only | **Fixed** — now infers provider from name prefix; slash format still supported for backwards compat |
| `src/config/models.ts` | Incorrectly changed to native IDs | **Fixed correctly** — native IDs kept; `providerFromModel()` updated to handle them |
| Tests | `provider/model` format in test fixtures | **Fixed** — all tests updated to native IDs; 97/97 pass |

---

## Ubiquitous language

| Term | Definition |
|---|---|
| **Thread** | A single research session. ID is a slug. State in `research/<thread-id>/.state.json`. |
| **Phase** | Pipeline stage: `brief`, `scout`, `groom`, `alternatives`, `docs`, `contract`, `evaluate`, `closed`. Some optional. |
| **Scout** | A trusted TS module implementing `ScoutDefinition` that performs one type of research recon and writes findings to `research/<thread-id>/raw/`. |
| **ScoutDefinition** | The interface a scout module exports as `default`. Contains static metadata + one executable method (`isAvailable()`). Trusted local code. |
| **Scout Registry** | Built at extension load: built-in scouts + `config.scouts[]` entries. Each checked via `isAvailable()` before dispatch. |
| **ScoutTaskSpec** | Runtime execution descriptor (`agentName`, `model` in native format, `prompt`, `outputFile`, `label`). Built by the registry from a `ScoutDefinition`. |
| **Native model ID** | The single model ID format used everywhere: no provider prefix, hyphens for version separators. e.g. `claude-haiku-4-5`, `gpt-5.5`, `gemini-2.5-pro`. Used in `models.ts` defaults, agent profile frontmatter, config overrides, and pi subagent dispatch. |
| **Oracle** | Cross-family adversarial reviewer at gate iii (after alternatives) and gate iv (after doc). Runs on `gpt-5.5`. |
| **Gate** | Named oracle checkpoint: `after-alternatives` (iii) or `after-doc` (iv). |
| **Groom** | Synthesis phase: scout raw findings → `synthesis.md` via 5-step meta-cognitive framework. |
| **Config** | TypeBox-validated object resolved at load. Resolution: hardcoded defaults ← global config ← project config ← env vars. |
| **Doctor** | `/research:doctor` — probes all deps in `--quick` or `--deep` mode; returns `DoctorReport`. |
| **canRunCommand** | The replacement for `canAvanceTo()` — checks whether a command is valid for the current thread state, including reruns and no-op commands. |

---

## Current architecture

### C4 Context — Current

```mermaid
C4Context
    title pi-deep-research Context (Current)

    Person(operator, "Operator", "Human running /research:* CLI commands via pi CLI")
    System(pdr, "pi-deep-research", "pi extension: 14 /research:* commands, linear pipeline brief→scout→groom→alternatives→docs→contract→evaluate→closed")
    System_Ext(pi_runtime, "pi coding agent runtime", "Host process: ExtensionAPI, ExtensionCommandContext, sendUserMessage")
    System_Ext(pi_subagents, "pi-subagents npm extension", "subagent tool for parallel dispatch")
    System_Ext(exa, "Exa MCP Server", "Web search — web scout")
    System_Ext(context7, "Context7 MCP Server", "OSS doc search — OSS scout")
    System_Ext(mempalace, "MemPalace MCP Server", "Memory — assumed always present; used in scout AND evaluate unconditionally; fails silently")
    System_Ext(gh, "GitHub CLI gh", "OSS repo data — OSS scout")
    System_Ext(librarian, "librarian pi extension", "OSS doc search — OSS scout (contradicts gh CLI)")

    Rel(operator, pdr, "Runs /research:* commands")
    Rel(pdr, pi_runtime, "Registers commands; sends instruction strings")
    Rel(pi_runtime, pi_subagents, "Dispatches parallel agents")
    Rel(pi_subagents, exa, "Web search")
    Rel(pi_subagents, context7, "OSS doc search")
    Rel(pi_subagents, mempalace, "Memory recall (scout) + persist (evaluate) — unconditional")
    Rel(pi_subagents, gh, "OSS repo data")
    Rel(pi_subagents, librarian, "OSS doc search")
    UpdateLayoutConfig($c4ShapeInRow: "4", $c4BoundaryInRow: "1")
```

### C4 Container — Current

```mermaid
C4Container
    title pi-deep-research Containers (Current)

    Person_Ext(operator, "Operator")
    System_Ext(pi_runtime, "pi coding agent runtime")
    System_Ext(fs, "Filesystem")

    System_Boundary(pdr, "pi-deep-research extension") {
        Container(cmd_handlers, "Command Handlers", "TypeScript", "14 in src/commands/ — inline phase guards, inconsistent, 4 doc commands unguarded")
        Container(state_store, "State Store", "TypeScript", "src/state/store.ts")
        Container(state_tracker, "State Tracker (DEAD)", "TypeScript", "src/state/tracker.ts — canAdvanceTo/nextPhase never imported")
        Container(model_config, "Model Config", "TypeScript", "src/config/models.ts — native IDs throughout (claude-haiku-4-5 etc.)")
        Container(provider_config, "Provider Config", "TypeScript", "src/config/providers.ts — providerFromModel() infers from prefix; checkProvider() called lazily")
        Container(scouts_base, "Scouts Base", "TypeScript", "src/scouts/base.ts — ScoutTaskSpec + buildScoutInstruction(); 4 scouts hardwired in scout.ts")
        Container(doc_instructions, "Doc Instruction Builder", "TypeScript", "src/docs/instructions.ts — identity ×4 hardcoded; evaluate always calls mempalace_add_drawer")
        Container(oracle_builder, "Oracle Instruction Builder", "TypeScript", "src/docs/oracle.ts — reads doc before it is written (Bug D)")
        Container(renderer, "Template Renderer", "TypeScript", "src/docs/render.ts")
        Container(mempalace_client, "MemPalace Client (UNUSED)", "TypeScript", "src/mempalace/client.ts — never called in production")
        Container(templates, "Prompt Templates + Agent Profiles", "Markdown", "templates/prompts/ + agents/")
    }

    Rel(operator, cmd_handlers, "Invokes commands")
    Rel(cmd_handlers, state_store, "r/w state")
    Rel(cmd_handlers, model_config, "Resolve model")
    Rel(cmd_handlers, provider_config, "Check provider (lazy)")
    Rel(cmd_handlers, scouts_base, "Build 4 hardwired ScoutTaskSpecs")
    Rel(cmd_handlers, doc_instructions, "Build instruction strings")
    Rel(cmd_handlers, oracle_builder, "Build oracle instruction (pre-write — bug)")
    Rel(doc_instructions, renderer, "Render templates")
    Rel(cmd_handlers, pi_runtime, "sendUserMessage")
    Rel(state_store, fs, "r/w .state.json")
    UpdateLayoutConfig($c4ShapeInRow: "4", $c4BoundaryInRow: "1")
```

### Known defects

| ID | Location | Defect | Severity | Status |
|---|---|---|---|---|
| A | `src/state/tracker.ts` | `canAdvanceTo`/`nextPhase` dead; inline phase guards inconsistent; 4 doc commands unguarded | High | Open |
| B | `src/commands/scout.ts:71` | `relevantPaths` always `[]` | Medium | Open |
| C | `templates/prompts/scout-oss.md` vs `agents/research-oss-scout.md` | Tool contradiction: prompt says `librarian`, agent profile says `gh` CLI | High | Open |
| D | `src/docs/oracle.ts` | `buildOracleContext` reads doc file before it is written | High | Open |
| E | `src/commands/new.ts:46-49` | MemPalace client implemented but never called; no graceful degradation | Medium | Open |
| F | `src/commands/new.ts:37-40` | `ctx.ui.select()` single-select despite "select all" label | Medium | Open |
| G | `src/config/models.ts` + agent profiles | All model IDs in OpenRouter-style prefix format; broke dispatch; agent profiles also wrong | High | **Fixed** — native IDs everywhere; `providerFromModel()` infers from prefix |
| H | `adr.ts`, `rfc.ts`, `design-doc.ts`, `document.ts` | Hard crash if `alternatives.md` missing | High | **Fixed** |
| I | `src/docs/instructions.ts` (evaluate) | `buildEvaluateInstruction` unconditionally calls `mempalace_add_drawer` | High | Open |
| J | `~/.pi/agent/state/pi-deep-research-active.json` | Global active-thread pointer machine-scoped; switching projects corrupts it | High | **Fixed** — moved to `<projectRoot>/.pi/deep-research/active.json` with legacy fallback |

---

## Proposed architecture

### C4 Context — Proposed

```mermaid
C4Context
    title pi-deep-research Context (Proposed)

    Person(operator, "Operator", "Configures identity + scouts via config.json; runs /research:doctor --quick before first thread")
    System(pdr, "pi-deep-research", "General-purpose extension: typed config, canRunCommand() guards, ScoutDefinition registry, /research:doctor, MemPalace-conditional evaluate, provider adapter table")
    System_Ext(pi_runtime, "pi coding agent runtime")
    System_Ext(pi_subagents, "pi-subagents npm extension")
    System_Ext(exa, "Exa MCP Server", "Web search — web scout")
    System_Ext(context7, "Context7 MCP Server", "OSS doc search — OSS scout")
    System_Ext(mempalace, "MemPalace MCP Server", "OPTIONAL — active only when config.mempalaceUrl set")
    System_Ext(gh, "GitHub CLI gh", "OSS repo data — OSS scout")
    System_Ext(custom_scouts, "Custom Scout Modules", "Operator's local TS files or npm packages; implement ScoutDefinition; trusted local code")

    Rel(operator, pdr, "Runs /research:* commands + /research:doctor")
    Rel(pdr, pi_runtime, "Registers commands; sends instructions")
    Rel(pi_runtime, pi_subagents, "Dispatches parallel agents")
    Rel(pi_subagents, exa, "Web search")
    Rel(pi_subagents, context7, "OSS doc search")
    Rel(pi_subagents, mempalace, "Memory recall + persist (optional)")
    Rel(pi_subagents, gh, "OSS repo data")
    Rel(pdr, custom_scouts, "Loads from config.scouts[] at extension load")
    UpdateLayoutConfig($c4ShapeInRow: "4", $c4BoundaryInRow: "1")
```

### C4 Container — Proposed

```mermaid
C4Container
    title pi-deep-research Containers (Proposed)

    Person_Ext(operator, "Operator")
    System_Ext(pi_runtime, "pi coding agent runtime")
    System_Ext(fs, "Filesystem")
    System_Ext(custom_scout_modules, "Custom Scout Modules")

    System_Boundary(pdr, "pi-deep-research extension") {
        Container(cmd_handlers, "Command Handlers", "TypeScript", "14 in src/commands/ — all use canRunCommand(); relevantPaths from args; alternatives optional; evaluate MemPalace-guarded")
        Container(cmd_policy, "Command Policy", "TypeScript", "src/state/commands.ts — canRunCommand(cmd, thread, files): RunResult; handles reruns + no-op commands")
        Container(state_store, "State Store", "TypeScript", "src/state/store.ts — unchanged interface")
        Container(config_loader, "Config Loader", "TypeScript", "src/config/loader.ts — TypeBox schema; four-layer resolution; validates at load")
        Container(model_config, "Model Config", "TypeScript", "src/config/models.ts — native IDs throughout")
        Container(provider_config, "Provider Config", "TypeScript", "src/config/providers.ts — KNOWN_PROVIDERS Set; providerFromModel() validates slash prefix + infers from native prefix; checkProvider() scoped to configured providers")
        Container(scout_registry, "Scout Registry", "TypeScript", "src/scouts/registry.ts — loads built-ins + config.scouts[]; isAvailable() with timeout; builds roster")
        Container(builtin_scouts, "Built-in Scouts", "TypeScript", "src/scouts/web/, src/scouts/oss/, src/scouts/repo/ — each exports ScoutDefinition as default")
        Container(memory_example, "Memory Scout Example", "TypeScript", "examples/memory-mempalace/ — ScoutDefinition; excluded when mempalaceUrl absent")
        Container(trends_example, "GitHub Trends Scout Example", "TypeScript", "examples/github-trends/ — ScoutDefinition using only bash/read; simpler onboarding example")
        Container(mempalace_client, "MemPalace Client", "TypeScript", "src/mempalace/client.ts — called by memory example + evaluate when mempalaceUrl set")
        Container(doctor_cmd, "Doctor Command", "TypeScript", "src/commands/doctor.ts — DoctorReport; --quick and --deep modes")
        Container(doc_instructions, "Doc Instruction Builder", "TypeScript", "src/docs/instructions.ts — author from config.user.name; evaluate MemPalace-guarded")
        Container(oracle_builder, "Oracle Instruction Builder", "TypeScript", "src/docs/oracle.ts — context built after doc is written")
        Container(renderer, "Template Renderer", "TypeScript", "src/docs/render.ts — unchanged")
    }

    Rel(operator, cmd_handlers, "Invokes /research:* commands")
    Rel(operator, doctor_cmd, "Runs /research:doctor --quick|--deep")
    Rel(cmd_handlers, cmd_policy, "canRunCommand() before execution")
    Rel(cmd_handlers, state_store, "r/w thread state")
    Rel(cmd_handlers, config_loader, "Read validated config")
    Rel(cmd_handlers, scout_registry, "Get available roster")
    Rel(scout_registry, builtin_scouts, "Load; isAvailable()")
    Rel(scout_registry, custom_scout_modules, "Load from config.scouts[]")
    Rel(memory_example, mempalace_client, "MemPalace API (optional)")
    Rel(cmd_handlers, doc_instructions, "Build instruction strings")
    Rel(cmd_handlers, oracle_builder, "Build oracle gate (post doc-write)")
    Rel(doc_instructions, renderer, "Render templates")
    Rel(doc_instructions, mempalace_client, "Evaluate persist (guarded)")
    Rel(cmd_handlers, pi_runtime, "sendUserMessage")
    Rel(provider_config, model_config, "providerFromModel() infers provider from native ID prefix")
    Rel(config_loader, fs, "Read config.json files")
    Rel(state_store, fs, "r/w .state.json")
    Rel(doctor_cmd, provider_config, "checkProvider() per model")
    Rel(doctor_cmd, scout_registry, "isAvailable() per scout")
    UpdateLayoutConfig($c4ShapeInRow: "4", $c4BoundaryInRow: "1")
```

---

## `ScoutDefinition` — trusted executable TS module

### V1 trust model (read this before authoring or loading scouts)

**External scouts execute arbitrary JavaScript in the host process.** Loading a scout from `config.scouts[]` is equivalent to running an npm package — there is no sandbox, no permission scoping, and no resource quota in v1. A malicious or buggy scout can read your filesystem, exfiltrate credentials, or hang the extension.

**v1 trust boundary — three explicit guards:**

1. **No auto-discovery:** the registry only loads scouts that are (a) built-in or (b) explicitly listed in `config.scouts[]`. There is no filesystem scan, no remote fetch, no npm install path.
2. **Explicit consent for external scouts:** `config.scouts[]` entries that resolve to a path **outside** `<projectRoot>/scouts/` or `<projectRoot>/examples/` require `config.allowExternalScouts: true` to load. Without that flag, the entry is rejected with a DoctorCheck error: `"external scout '<path>' requires config.allowExternalScouts: true; only enable in trusted workspaces"`.
3. **Built-in scouts and project-local examples are trusted by default:** these ship with the extension or with the project repo and are already under operator review.

```jsonc
// .pi/deep-research/config.json
{
  "allowExternalScouts": true,           // required for paths outside projectRoot/scouts or projectRoot/examples
  "scouts": [
    "web",                                 // built-in — always allowed
    "./scouts/my-scout.js",                // project-local — always allowed
    "/Users/me/shared/jira-scout.js"       // requires allowExternalScouts: true
  ]
}
```

`/research:doctor` always surfaces the loaded scout roster with the trust source (built-in, project-local, external) so the operator can audit what's running.

**Sandboxing is deferred to v2.** v1 protects against accident, not against malice. Treat `config.scouts[]` entries the way you treat a `package.json` dependency: only add what you've reviewed.

### Initialization timing — first command, not extension load

The extension does **not** load scouts at activation time. Activation only registers commands. All scout/config initialization happens on the **first command invocation**, when `ctx.cwd` is stable and the operator has shown intent:

```
extension activate → register commands (fast, no I/O)
                      ↓
operator runs /research:* → ensureInitialized(ctx.cwd)
                              ↓ (memoized BY RESOLVED CONFIG PATH, not by session)
                              1. resolve config file path = nearest .pi/deep-research/config.json
                              2. if cached(configPath) → return cached registry
                              3. else: validate config, Stage 1 load scouts, cache by configPath
```

**Why keyed by config path, not session:** in pi sessions that switch between projects (or workspaces with multiple roots), the first command would otherwise poison the registry with the wrong project's config for the rest of the session. Keying by resolved config path means switching projects gets a fresh registry. The lookup itself is fast (single readlink + fs.stat).

This resolves the pass-5 contradiction between "Stage 1 at extension load" and "lazy config (cwd unstable at load)" — there is one initialization point, and it correctly handles multi-workspace pi sessions.

### Module format — compiled .js, not .ts

To eliminate questions about TypeScript loader support in the packaged extension runtime:
- **Built-in scouts**: imported statically from `src/scouts/{web,oss,repo}/index.ts` (compiled to `.js` at publish time).
- **Custom scouts**: must be **pre-compiled `.js` or `.mjs`** files. Operators write TypeScript locally and compile, or ship npm packages (v2). Documented in `docs/CUSTOM-SCOUTS.md`.

### Two-stage loading

**Stage 1 — Static import + interface validation** (during `ensureInitialized()`)
```typescript
async function loadScout(spec: ScoutSpec, projectRoot: string): Promise<LoadResult> {
  const resolvedPath = resolveScoutPath(spec, projectRoot); // built-in id | absolute | project-relative
  enforceTrustBoundary(resolvedPath, projectRoot, config);  // throws if external + !allowExternalScouts
  try {
    // 5s wall-clock backstop. NOTE: this is DIAGNOSTIC, NOT SAFETY.
    // A Promise.race timeout cannot interrupt synchronous top-level code,
    // CPU loops, or side effects inside the imported module. It only ensures
    // loadScout() eventually returns so the registry build doesn't hang forever.
    // True isolation (killable child process) is deferred to v2.
    const mod = await withTimeout(import(resolvedPath), 5000);
    const scout = validateScoutInterface(mod.default);
    checkApiVersion(scout);
    return { ok: true, scout, trustSource: classifyTrust(resolvedPath, projectRoot) };
  } catch (e) {
    return { ok: false, error: e, spec };  // becomes DoctorCheck "error"
  }
}
```

**Timeout semantics — what the backstop does and does not do:**

| Failure mode | Backstop behavior |
|---|---|
| Slow async top-level await | Caught → DoctorCheck "error" with timeout message |
| Synchronous CPU loop in module body | **NOT caught** — host process hangs; operator must kill the pi session |
| Top-level side effects (file writes, network calls) | **Already executed** before timeout fires |
| Memory exhaustion | **NOT caught** — would require resource limits we don't have in v1 |

The backstop is sufficient for **operational diagnostics** (a hung import shows up in `/research:doctor` instead of silently freezing). It is **not a security boundary**. The trust-boundary check above (workspace-trust gating + `allowExternalScouts`) is the actual safety mechanism. Sandboxing-grade isolation is deferred to v2 (see "Deferred to v2" section).

**Stage 2 — Availability probe** (in `doctor --deep` or before scout dispatch, returns rich result)
```typescript
export type AvailabilityResult =
  | { available: true }
  | { available: false; reason: "false" | "timeout" | "error"; detail?: string };

async function probeAvailability(scout: ScoutDefinition): Promise<AvailabilityResult> {
  const timeoutMs = scout.timeoutMs ?? 2000;
  let timedOut = false;
  const result = await Promise.race([
    scout.isAvailable().then(b => ({ kind: "probe", value: b } as const)),
    sleep(timeoutMs).then(() => { timedOut = true; return { kind: "timeout" } as const; }),
  ]).catch(e => ({ kind: "error", error: e } as const));

  if (result.kind === "probe") {
    return result.value ? { available: true } : { available: false, reason: "false" };
  }
  if (result.kind === "timeout") return { available: false, reason: "timeout" };
  return { available: false, reason: "error", detail: String((result as any).error) };
}
```

The rich result preserves the operational distinction between **"probe returned false"** (expected — credential missing), **"probe timed out"** (scout is buggy), and **"probe threw"** (scout has a code error). All three become distinct `DoctorCheck` entries.

### API version compatibility

The host exports `SCOUT_API_VERSION = 1`. Rules at Stage 1:
- `scout.scoutApiVersion === SCOUT_API_VERSION`: OK
- `scout.scoutApiVersion < SCOUT_API_VERSION`: warn in doctor; attempt to load (best effort)
- `scout.scoutApiVersion > SCOUT_API_VERSION`: error; exclude with "upgrade the extension" message

### `config.scouts[]` discovery syntax

Each entry is either a **string** (simple form) or an **object** (rich form with plugin config):

```typescript
// String form — built-in id or path
"web"  // built-in (loaded from src/scouts/web/index.js)
"/Users/me/scouts/memory.js"               // absolute path
"./scouts/my-scout/index.js"               // project-relative (resolved from projectRoot)

// Object form — for custom config or path-with-options
{ id: "web" }                              // explicit built-in
{ path: "./scouts/memory.js", config: { wing: "engineering", maxResults: 5 } }
{ path: "./scouts/jira.js", config: { project: "ENG", token: "$JIRA_TOKEN" } }

// npm package: NOT supported in v1 — deferred to v2
```

**Resolution rules:**
- Built-in id → `src/scouts/<id>/index.js` (compiled)
- Path starting with `/` → absolute
- Path starting with `./` or `../` → resolved against `projectRoot` (real path; symlinks resolved)
- Other strings → treated as built-in id; unknown id produces `DoctorCheck` error
- Duplicate `id` (after resolution) → later entry in array wins + warning
- Load order = config array order
- File must be `.js` or `.mjs` (compiled); `.ts` rejected with clear message

**Plugin-specific config:** the `config` field is **opaque to the host**. The scout receives its `config` slice via the second argument to `isAvailable(config)` and inside the prompt context. The scout is responsible for validating its own config (recommended: TypeBox or Zod schema in the scout's own module).

```typescript
// In a scout module:
isAvailable(config?: unknown): Promise<boolean> {
  const parsed = MyScoutConfig.parse(config); // scout validates
  return Boolean(process.env[parsed.tokenEnv]);
}
```

```typescript
// src/scouts/types.ts

/** Current ScoutDefinition API version. Scouts must declare this. */
export const SCOUT_API_VERSION = 1 as const;

export interface ScoutDefinition {
  // ── Version ──────────────────────────────────────────────────────────────────
  /**
   * Must equal SCOUT_API_VERSION at runtime. Number (not literal type) so older/newer
   * scouts can still be inspected at runtime; the loader compares numerically.
   * Authors write: `scoutApiVersion: 1`.
   */
  readonly scoutApiVersion: number;
  /** Semver of this scout implementation. Displayed in /research:doctor. e.g. "1.0.0" */
  readonly version: string;

  // ── Static identity ──────────────────────────────────────────────────────────
  readonly id: string;           // unique across registry; used in filenames and config
  readonly label: string;        // shown in /research:scout UI
  readonly description: string;  // shown in /research:doctor

  // ── Declarative dependency metadata ─────────────────────────────────────────
  readonly mcpTools: readonly string[];     // doctor checks in --deep mode
  readonly cliBinaries: readonly string[];  // doctor checks via which in --deep mode
  readonly envVars: readonly string[];      // documented for operators; used in isAvailable()
  readonly unavailableReason: string;       // shown when isAvailable() returns false

  // ── Agent and prompt ─────────────────────────────────────────────────────────
  readonly agentProfile: string;            // absolute path to agent .md
  readonly promptTemplate: string;          // absolute path to prompt template .md
  readonly promptVariables: readonly string[];  // {{varName}} vars expected in template

  // ── Model ────────────────────────────────────────────────────────────────────
  readonly defaultModel: string;            // native ID e.g. "claude-haiku-4-5"
  readonly agentName: string;               // pi agent registry name e.g. "research-web-scout"

  // ── Output ───────────────────────────────────────────────────────────────────
  readonly outputFilePattern: string;       // "web-{n}-{threadId}.md"
  readonly requiredOutputSections: readonly string[];  // warns if missing; does not fail

  // ── Execution policy ─────────────────────────────────────────────────────────
  readonly timeoutMs?: number;              // default 2000; applies to Stage 2 probe
  readonly onUnavailable?: "skip" | "warn" | "error";  // default "warn"

  // ── Module-relative path helper (recommended over absolute paths) ───────────
  // Scout authors should use this pattern instead of hardcoded absolute paths:
  //   readonly agentProfile = fileURLToPath(new URL("./agent.md", import.meta.url));
  // This makes the scout portable across installation locations.

  // ── Executable (Stage 2 only) ────────────────────────────────────────────────
  /**
   * Returns true (or rich result) if this scout can run in the current environment.
   * Called in Stage 2 (probe phase), NOT at import time.
   * Receives the scout's `config` slice from config.scouts[] (object form) — opaque to host.
   * Check env vars, binaries, file existence — NOT network calls.
   *
   * Return shape:
   *   - `true` / `false`                          — simple form (most scouts)
   *   - `{ available: true }`                     — explicit positive
   *   - `{ available: false, reason: string }`    — structured negative (preferred for clarity)
   *
   * Throwing → DoctorCheck "error" with the thrown message.
   * Timing out beyond timeoutMs → DoctorCheck "warn" with timeout reason.
   * The host normalizes all return shapes into AvailabilityResult before exposing in doctor.
   */
  isAvailable(config?: unknown): Promise<boolean | { available: true } | { available: false; reason: string }>;
}
```

### Default scout roster policy

| `config.mempalaceUrl` | Default roster | Behaviour |
|---|---|---|
| Not set | `[web, oss, repo]` | Memory scout NOT loaded; groom receives 3 raw files; no warning |
| Set | `[web, oss, repo, memory-example]` (if `isAvailable()` passes) | Memory scout loaded from `examples/memory-mempalace/` |
| Any | + any `config.scouts[]` entries that pass `isAvailable()` | Custom scouts appended; `onUnavailable` controls missing ones |

Groom/synthesis instructions are **scout-count agnostic** — they read all files in `raw/` regardless of how many scouts ran. No structural change needed.

---

## Model/provider architecture

### Implemented approach: native IDs everywhere

All model IDs use native pi format throughout — no provider prefix, no conversion step:

| Location | Format | Example |
|---|---|---|
| `src/config/models.ts` defaults | Native | `claude-haiku-4-5` |
| Agent profile `model:` frontmatter | Native | `claude-haiku-4-5` |
| `config.agents` user overrides | Native | `gpt-5.5` |
| pi `subagent` tool `model:` field | Native | `claude-haiku-4-5` |

`providerFromModel()` was updated to infer provider from name prefix, so `checkProvider()` continues to work without requiring a slash:

```typescript
export type KnownProvider = "anthropic" | "openai" | "google";

/** Runtime-validated set of providers we know how to authenticate against. */
const KNOWN_PROVIDERS = new Set<KnownProvider>(["anthropic", "openai", "google"]);

function isKnownProvider(s: string): s is KnownProvider {
  return KNOWN_PROVIDERS.has(s as KnownProvider);
}

export function providerFromModel(modelId: string): KnownProvider | "unknown" {
  // Legacy slash format: validate the prefix against KNOWN_PROVIDERS at RUNTIME,
  // not just via TypeScript cast. "openrouter/foo" → "unknown", not "openrouter".
  const slash = modelId.indexOf("/");
  if (slash >= 0) {
    const prefix = modelId.slice(0, slash);
    return isKnownProvider(prefix) ? prefix : "unknown";
  }

  // Native model ID — infer from name prefix
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gpt-") || /^o[1-9]/.test(modelId)) return "openai";
  if (modelId.startsWith("gemini-")) return "google";

  return "unknown";
}

// In checkProvider(): provider === "unknown" → DoctorCheck status "warn"
// (NEVER available: true). Detail: "unrecognized model ID 'xyz'; configure
// providerFromModel or use a built-in provider"
```

**Test coverage** (`tests/config/provider-from-model.test.ts`):
```typescript
// Known slash
expect(providerFromModel("anthropic/claude-haiku-4.5")).toBe("anthropic");
// Unknown slash — was the bug
expect(providerFromModel("openrouter/foo")).toBe("unknown");
expect(providerFromModel("azure/bar")).toBe("unknown");
expect(providerFromModel("gptt/typo")).toBe("unknown");  // typo prefix
// Native
expect(providerFromModel("claude-haiku-4-5")).toBe("anthropic");
expect(providerFromModel("gpt-5.5")).toBe("openai");
expect(providerFromModel("o3-mini")).toBe("openai");
expect(providerFromModel("gemini-2.5-pro")).toBe("google");
// Unknown native
expect(providerFromModel("llama-3")).toBe("unknown");
expect(providerFromModel("gptt-5.5")).toBe("unknown");  // typo
```

This is simpler than the pass-3 `PROVIDER_ADAPTERS` / `dispatchModelId()` design: no conversion at dispatch sites, no adapter table to maintain, no special CI lint rule. 97/97 tests pass with native IDs.

---

## Command policy — replacing `canAvanceTo()`

The oracle identified that `canAvanceTo()` only models strict forward transitions, breaking reruns and no-op commands. Replacement: `canRunCommand()` with a full policy table.

```typescript
// src/state/commands.ts

export type RunOutcome = "advance" | "rerun" | "noop" | "blocked";

export interface CommandPolicy {
  /** Which phases allow this command. "any" = always allowed. */
  allowedPhases: Phase[] | "any";
  /** Phase the command advances to on success. undefined = no change. */
  advancesTo?: Phase;
  /** True if the command may run again in the same phase (rerun). */
  allowRerun: boolean;
  /** All of these files (relative to threadDir) must exist. */
  requiredAll?: string[];
  /** Custom predicate for state-dependent checks (oracle gate, contract doc). */
  customCheck?: (thread: ThreadState, threadDir: string) => Promise<CheckResult>;
}

export interface CheckResult { ok: boolean; reason?: string; }

const hasAnyLinkedDoc = (t: ThreadState): boolean =>
  (t.linkedDocs.adr?.length ?? 0) > 0 ||
  Boolean(t.linkedDocs.rfc) ||
  Boolean(t.linkedDocs.designDoc) ||
  Boolean(t.linkedDocs.prd);

export const COMMAND_POLICIES: Record<string, CommandPolicy> = {
  "research:new":          { allowedPhases: "any", allowRerun: false, advancesTo: "brief" },
  "research:scout":        { allowedPhases: ["brief", "scout"], allowRerun: true, requiredAll: ["brief.md"], advancesTo: "scout" },
  "research:groom":        { allowedPhases: ["scout", "groom"], allowRerun: true, requiredAll: ["brief.md"], advancesTo: "groom" },
  "research:alternatives": { allowedPhases: ["groom", "alternatives"], allowRerun: true, requiredAll: ["synthesis.md"], advancesTo: "alternatives" },
  "research:document":     { allowedPhases: ["groom", "alternatives", "docs", "contract", "evaluate"], allowRerun: true, requiredAll: ["synthesis.md"], advancesTo: "docs" },  // ← FIX: advances to docs
  "research:adr":          { allowedPhases: ["groom", "alternatives", "docs", "contract", "evaluate"], allowRerun: true, requiredAll: ["synthesis.md"], advancesTo: "docs" },
  "research:rfc":          { allowedPhases: ["groom", "alternatives", "docs", "contract", "evaluate"], allowRerun: true, requiredAll: ["synthesis.md"], advancesTo: "docs" },
  "research:design-doc":   { allowedPhases: ["groom", "alternatives", "docs", "contract", "evaluate"], allowRerun: true, requiredAll: ["synthesis.md"], advancesTo: "docs" },
  "research:prd":          { allowedPhases: ["groom", "alternatives", "docs", "contract", "evaluate"], allowRerun: true, requiredAll: ["synthesis.md"], advancesTo: "docs" },

  // FIX: oracle gate depends on phase. customCheck encodes the example logic.
  "research:oracle": {
    allowedPhases: ["alternatives", "docs", "contract", "evaluate"],
    allowRerun: true,
    customCheck: async (thread, threadDir) => {
      if (thread.phase === "alternatives") {
        const ok = await fileExists(join(threadDir, "alternatives.md"));
        return ok ? { ok: true } : { ok: false, reason: "alternatives.md required for after-alternatives gate" };
      }
      // phase ≥ docs: oracle reviews a linked doc
      return hasAnyLinkedDoc(thread)
        ? { ok: true }
        : { ok: false, reason: "no linked doc; run /research:adr|rfc|design-doc|prd first" };
    },
  },

  // FIX: contract requires at least one linked doc to operate on.
  "research:contract": {
    allowedPhases: ["docs", "contract"],
    allowRerun: true,
    advancesTo: "contract",
    customCheck: async (thread) =>
      hasAnyLinkedDoc(thread)
        ? { ok: true }
        : { ok: false, reason: "contract needs at least one ADR/RFC/Design Doc/PRD; run a doc command first" },
  },

  "research:evaluate":     { allowedPhases: ["contract", "evaluate"], allowRerun: true, requiredAll: ["contract.md"], advancesTo: "evaluate" },
  "research:doctor":       { allowedPhases: "any", allowRerun: true },
  "research:status":       { allowedPhases: "any", allowRerun: true },
};

export async function canRunCommand(
  command: string,
  thread: ThreadState,
  threadDir: string
): Promise<CheckResult> {
  const policy = COMMAND_POLICIES[command];
  if (!policy) return { ok: false, reason: `unknown command: ${command}` };

  // 1. Phase guard
  if (policy.allowedPhases !== "any" && !policy.allowedPhases.includes(thread.phase)) {
    return { ok: false, reason: `phase ${thread.phase} does not allow ${command}; allowed: ${policy.allowedPhases.join(", ")}` };
  }
  // 2. Required files
  for (const f of policy.requiredAll ?? []) {
    if (!(await fileExists(join(threadDir, f)))) {
      return { ok: false, reason: `required file missing: ${f}` };
    }
  }
  // 3. Custom check (state-dependent)
  if (policy.customCheck) {
    return policy.customCheck(thread, threadDir);
  }
  return { ok: true };
}
```

**State examples — all 14 commands must be covered:**

| Command | Scenario | Expected outcome |
|---|---|---|
| `research:new` | Any phase | ok — always allowed (creates new thread, does not touch active) |
| `research:scout` | phase=`brief`, `brief.md` exists | ok — advances to `scout` |
| `research:scout` | phase=`scout` | ok — rerun allowed |
| `research:scout` | phase=`groom` | blocked — "already past scout phase; use /research:status" |
| `research:scout` | phase=`brief`, `brief.md` missing | blocked — `requiredAll: ["brief.md"]` failed |
| `research:groom` | phase=`scout`, `brief.md` exists | ok — advances to `groom` |
| `research:groom` | phase=`groom` | ok — rerun allowed (same phase still in `allowedPhases`) |
| `research:groom` | phase=`brief` | blocked — phase not in `allowedPhases` |
| `research:design-doc` | phase=`groom`, `synthesis.md` exists | ok — advances to `docs` |
| `research:design-doc` | phase=`docs` | ok — rerun allowed (produces new doc number) |
| `research:design-doc` | phase=`brief` | blocked — phase not in `allowedPhases` |
| `research:document` | phase=`groom`, `synthesis.md` exists | ok — advances to `docs` (matches doc commands) |
| `research:oracle` | phase=`alternatives`, `alternatives.md` missing | blocked by `customCheck` — "alternatives.md required for after-alternatives gate" |
| `research:oracle` | phase=`alternatives`, `alternatives.md` exists | ok |
| `research:oracle` | phase=`docs`, ≥1 linked doc | ok — `customCheck` finds linked doc |
| `research:oracle` | phase=`docs`, no linked doc | blocked by `customCheck` — "no linked doc; run /research:adr\|rfc\|design-doc\|prd first" |
| `research:contract` | phase=`docs`, no linked doc | blocked by `customCheck` — "contract needs at least one ADR/RFC/Design Doc/PRD" |
| `research:contract` | phase=`docs`, ≥1 linked doc | ok — advances to `contract` |
| `research:evaluate` | phase=`contract`, `contract.md` exists | ok — advances to `evaluate` |
| `research:evaluate` | phase=`evaluate` | ok — rerun allowed |
| `research:doctor` | any phase | ok — no state change |
| `research:status` | any phase | ok — no state change |

**Implementation notes:**
- `requiredAll` is checked against actual filesystem, not thread state — catches interrupted commands (state advanced but file not written).
- `customCheck` is the escape hatch for state-dependent rules; oracle and contract use it because their requirements depend on `thread.phase` and `thread.linkedDocs`.
- Every example in this table is encoded by the policy table or `customCheck`; there is no hidden logic. **A CI test (`tests/state/command-policy.test.ts`) runs `canRunCommand` against each row and asserts the expected outcome.**

---

## Config schema (TypeBox — existing dependency)

```typescript
// src/config/schema.ts
import { Type, Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/** A scouts[] entry: built-in id or path (string), OR rich object with config. */
const ScoutEntry = Type.Union([
  Type.String(),  // "web" | "/abs/path.js" | "./rel/path.js"
  Type.Object({
    id: Type.Optional(Type.String()),
    path: Type.Optional(Type.String()),
    config: Type.Optional(Type.Unknown()),  // opaque to host; scout validates
  }),
]);

export const ConfigSchema = Type.Object({
  /** Config schema version. Currently always 1. Used for future migrations. */
  version: Type.Optional(Type.Literal(1)),

  user: Type.Object({
    name: Type.String({ default: "Unknown" }),
    team: Type.String({ default: "" }),
  }, { default: {} }),

  agents: Type.Record(
    Type.String(), Type.String(),
    { default: {}, description: "Override model per agent. Native pi format: 'claude-haiku-4-5'" }
  ),

  scouts: Type.Array(
    ScoutEntry,
    { default: [], description: "Built-in ids, paths, or rich objects with plugin config. npm: v2 only." }
  ),

  mempalaceUrl: Type.Optional(
    Type.String({ format: "uri", description: "Enables memory scout + evaluate persist. e.g. http://localhost:8080" })
  ),

  /**
   * Trust gate for external scouts (paths outside projectRoot/scouts or projectRoot/examples).
   * Default false. Set true ONLY in trusted workspaces. Without this, external entries are
   * rejected by the loader with a DoctorCheck error.
   */
  allowExternalScouts: Type.Boolean({ default: false }),

  docs: Type.Object({
    outputDir: Type.String({ default: "docs" }),
  }, { default: {} }),
}, { additionalProperties: false });

export type Config = Static<typeof ConfigSchema>;

/**
 * Apply TypeBox defaults explicitly. TypeBox annotations alone do not materialize
 * defaults — must call Value.Default before validation.
 * Tests in `tests/config/loader.test.ts` cover: {}, missing user, missing docs,
 * missing agents, missing scouts, missing every section.
 */
export function loadAndValidateConfig(raw: unknown): Config {
  const withDefaults = Value.Default(ConfigSchema, raw);
  return Value.Parse(ConfigSchema, withDefaults);
}
```

**Default scout roster** (when `config.scouts === []` or omitted): the registry materializes `[{ id: "web" }, { id: "oss" }, { id: "repo" }]`. If `config.mempalaceUrl` is set, also `{ id: "memory" }` from `examples/memory-mempalace/`. Setting `config.scouts: []` explicitly to disable all scouts is **not** supported in v1 — use a sentinel value or omit the key to get defaults. Explicitly setting `scouts: ["web"]` replaces the entire default roster with just `web`.

### Exact config locations and resolution

| Priority | Source | Path |
|---|---|---|
| 1 (lowest) | TypeBox defaults | (in schema above) |
| 2 | User global config | `~/.pi/deep-research/config.json` |
| 3 | Project config | `.pi/deep-research/config.json` (checked into repo) |
| 4 (highest) | Env vars | `PI_RESEARCH_USER_NAME`, `PI_RESEARCH_USER_TEAM`, `MEMPALACE_URL` |

**Merge semantics:**
- `user.*` and `mempalaceUrl`: scalar override (higher priority wins)
- `agents`: map merge (higher priority entries overwrite individual keys; lower-priority keys kept)
- `scouts`: **replace** (project config `scouts` replaces global `scouts`; env vars cannot set `scouts`)
- `docs.*`: scalar override

**Unknown keys:** rejected at parse time (TypeBox `additionalProperties: false`). Error shows the offending key and points to `docs/CONFIG.md`.

**Failure UX:** if config parse fails, the extension loads with defaults and prints a single error line:
```
[pi-deep-research] Config error in .pi/deep-research/config.json: <error>. Using defaults. Run /research:doctor for details.
```

**Extension-load timing:** pi extensions do not guarantee stable `ctx.cwd` at load time. Config resolution therefore runs lazily on the **first command invocation**, not at module load. The result is cached for the session. `/research:doctor` forces re-resolution.

---

## `/research:doctor` — quick and deep modes

```typescript
// src/commands/doctor.ts

export interface DoctorCheck {
  name: string;
  mode: "quick" | "deep";         // which mode runs this check
  status: "ok" | "warn" | "error";
  detail: string;
  remedy?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  scoutRoster: { id: string; available: boolean; reason?: string }[];
  configSummary: {
    user: string;
    mempalaceUrl: string | null;
    activeModels: Record<string, string>;  // registry format
    loadedScouts: string[];
  };
}
```

| Check ID | Mode | How | Failure remedy |
|---|---|---|---|
| `config.parse` | quick | TypeBox validate + `Value.Default` | Show errors; point to `docs/CONFIG.md` |
| `credential.<provider>` | quick | **Only for providers used by configured models.** Inspect `models.ts` defaults + `config.agents`; emit one check per distinct provider. `process.env["<KEY>"]` or `~/.pi/agent/auth.json`. | Set `<KEY>` env var; for OpenAI also see `~/.pi/agent/models.json` for regional base URL |
| `dir.research.writable` | quick | `fs.access(join(projectRoot, "research"), W_OK)` | Check permissions; create dir if missing |
| `dir.docs.writable` | quick | `fs.access(join(projectRoot, config.docs.outputDir), W_OK)` | Check permissions |
| `extension.pi-subagents` | deep | Try `require.resolve("pi-subagents")` or equivalent in pi runtime | `pi install npm:pi-subagents` |
| `scout.<id>.loaded` | deep | Stage 1 import + interface validation result | Fix import error; check `scoutApiVersion` |
| `scout.<id>.available` | deep | Stage 2 probe with `scout.timeoutMs ?? 2000` timeout; returns rich `AvailabilityResult` distinguishing false/timeout/error | Scout's `unavailableReason`; for `reason: "timeout"` increase timeoutMs; for `reason: "error"` see `detail` |
| `scout.<id>.env.<NAME>` | deep | For each `envVars[]`: `process.env[NAME]` set | Set `<NAME>` env var |
| `scout.<id>.binary.<name>` | deep | For each `cliBinaries[]`: cross-platform lookup (uses `which` npm package — honors `PATH` + Windows `PATHEXT`) | Install binary; PATH troubleshooting |
| `scout.<id>.mcpTool.<name>` | deep | For each `mcpTools[]`: best-effort presence check via pi-mcp-adapter | Ensure MCP server is running and tool is registered |
| `scout.<id>.agentProfile` | deep | `fs.access(scout.agentProfile)` | Scout authoring bug — fix `agentProfile` path |
| `scout.<id>.promptTemplate` | deep | `fs.access(scout.promptTemplate)` | Scout authoring bug — fix `promptTemplate` path |

**Credential scoping:** doctor inspects the merged config (`models.ts` defaults + `config.agents` overrides + scout `defaultModel`) to determine which providers are needed. A user running Anthropic-only models gets only `credential.anthropic` — no warnings about missing OpenAI/Google keys.

**Unknown providers (OpenRouter, Azure OpenAI, Ollama, Groq, etc.):** if a configured model ID resolves to `provider === "unknown"` (see `providerFromModel()`), doctor emits a **WARN** check `credential.unknown.<modelId>`:

```
credential.unknown.openrouter/foo
  status: warn
  detail: "Model 'openrouter/foo' maps to unknown provider; credential check skipped"
  remedy: "Set credentials via your provider's documented env var; or override providerFromModel() in a future v2 by adding to KNOWN_PROVIDERS"
```

This avoids silent breakage (model dispatches but auth fails opaquely) while making the limitation explicit. v2 will support provider overrides via `config.providers: Record<string, ProviderDef>`.

Usage:
```
/research:doctor          # runs quick checks only (< 2s)
/research:doctor --deep   # runs all checks (may take 10–30s)
```

`/research:new` runs a quick preflight check inline (not a warning about doctor) and surfaces the result before asking for thread details.

### `doctor --json` — machine-readable output

```
/research:doctor --json
/research:doctor --deep --json
```

**Exit codes:** 0 = all checks ok, 1 = at least one warn, 2 = at least one error.

**Output schema:**
```json
{
  "version": 1,
  "exitCode": 0,
  "mode": "quick",
  "checks": [
    {
      "id": "config.parse",
      "mode": "quick",
      "status": "ok",
      "detail": "Loaded from .pi/deep-research/config.json",
      "remedy": null
    },
    {
      "id": "credential.anthropic",
      "mode": "quick",
      "status": "error",
      "detail": "ANTHROPIC_API_KEY not set",
      "remedy": "Set ANTHROPIC_API_KEY environment variable"
    }
  ],
  "scoutRoster": [
    { "id": "web", "available": true },
    { "id": "memory", "available": false, "reason": "MEMPALACE_URL not set" }
  ],
  "configSummary": {
    "user": "Ruslan Kurchenko",
    "mempalaceUrl": null,
    "activeModels": { "research-web-scout": "claude-haiku-4-5" },
    "loadedScouts": ["web", "oss", "repo"]
  }
}
```

Stable check IDs (for CI parsing): `config.parse`, `credential.anthropic`, `credential.openai`, `credential.google`, `dir.research.writable`, `dir.docs.writable`, `extension.pi-subagents` (deep), `scout.<id>.available` (deep), `scout.<id>.binary.<name>` (deep).

---

## Alternatives matrix

| Alternative | Effort | Reuse | Complexity | Oracle verdict | Chosen |
|---|---|---|---|---|---|
| **A — Executable TS module plugins** (this doc) | Medium | High | Low | Viable with explicit trust model | ✅ |
| A' — Static JSON manifest + built-in checker types | Medium | Medium | Medium | Avoids trust issue; too rigid for complex checks | ❌ |
| **B — npm plugin registry** | High | Very high | High | Premature; stabilise API first | ❌ |
| **C — YAML DAG orchestration** | Very high | Very high | Very high | Overkill at ~1K LoC | ❌ |
| **D — Stage ABCs (STORM-style)** | Medium | Medium | Medium | Inappropriate scale | ❌ |
| **E — Capability-based scout selection** | Medium | High | Low | Good long-term; deferred post-ScoutDefinition | 🔜 |

---

## Trade-offs

| Decision | Gain | Cost |
|---|---|---|
| Executable TS plugins over static manifests | Real environment checks; no reimplemented checker DSL | Arbitrary local code at load; trust must be documented |
| `KNOWN_PROVIDERS` Set + `isKnownProvider()` type guard | Runtime validation; no lying casts; explicit failure for unknown providers | New providers require adding to the Set + tests |
| `customCheck` callbacks in `CommandPolicy` | Encodes state-dependent rules in the table itself; no hidden logic | One more function to write per stateful command; tests must run the predicate, not just inspect the table |
| Compiled `.js` for scouts (not `.ts`) | No runtime TypeScript loader question; works in any pi runtime | Custom scout authors must pre-compile (documented) |
| Object-form `scouts[]` entries with opaque `config` | Plugin-specific config without host-side schema knowledge | Scout authors own their config validation; host can't catch bad config at startup |
| First-command init (memoized by resolved config path) | One init point; no extension-load timing race; cwd is stable; multi-workspace pi sessions don't cross-contaminate | First command has slightly higher latency (~50ms for config + Stage 1); cache invalidation happens on config-path change |
| Rich `AvailabilityResult` (not bool) | Preserves false/timeout/error distinction; doctor surfaces operational reality | Slightly more code in scout authors who want to bubble up errors |
| Doctor scopes credential checks to configured providers | No irrelevant warnings; respects "Anthropic-only" minimal setups | One more inspection step at quick-mode startup |
| `canRunCommand()` over `canAvanceTo()` | Handles reruns, no-ops, file prerequisites | More code; policy table must stay in sync with commands |
| Default roster: 3 scouts (no memory) | Works with zero external services | Users who want memory must opt in explicitly |
| TypeBox over Zod | Zero new dependencies | Slightly more verbose; no `transform` support |
| Lazy config validation (first command) | No startup delay; no cwd race | Config errors appear on first command, not at load |
| `/research:new` inline quick preflight | Operator gets immediate feedback without running doctor | Adds latency to `/research:new` |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `KNOWN_PROVIDERS` set out of date when pi adds a new built-in provider | Low | Medium — false "unknown" warning | CI matrix test against latest pi releases; explicit error message tells user to update the set |
| Plugin's `isAvailable()` hangs beyond timeout | Low | Low — `AvailabilityResult` returns `{available: false, reason: "timeout"}`; scout excluded with clear reason in doctor | `timeoutMs` configurable per scout; default 2000ms; rich result preserves the timeout vs error distinction |
| Stage 1 import hangs (top-level await loop) | Low | High — extension first-command latency | Stage 1 has own 5s timeout via `withTimeout()`; failure → DoctorCheck `error` and scout excluded |
| Scout `.ts` file mistakenly used in `config.scouts[]` | Medium | Low — confusing import error | Loader detects `.ts` extension and emits a specific DoctorCheck: "compile to .js first; see docs/CUSTOM-SCOUTS.md" |
| `customCheck` callback throws | Low | Medium — command incorrectly blocked or allowed | `canRunCommand()` wraps callbacks in try/catch; thrown → `{ok: false, reason: "customCheck failed: <error>"}`; unit-tested for every policy |
| TypeBox version mismatch with pi-coding-agent | Low | Low | Pin version in `package.json` |
| Command policy table drifts from actual command set | Medium | Medium — guard bypassed | CI test: assert every registered command has a `COMMAND_POLICIES` entry |
| MemPalace example stales and breaks custom-scout docs | Medium | Medium | CI smoke test: import `examples/memory-mempalace/index.ts`, call `isAvailable()`, assert boolean result |
| Lazy config validation hides errors until runtime | Low | Medium | Quick preflight in `/research:new` surfaces most config issues early |
| Bug D oracle timing race remains after fix | Low | High | Integration test: assert oracle output file contains ≥3 headings from the reviewed doc |
| `evaluate` MemPalace guard misses instruction text | Medium | Medium | Audit full `buildEvaluateInstruction` output for any MemPalace-specific text; test with no `mempalaceUrl` |

---

## Migration plan

### Release gate — restructured

The pass-5 gate was muddled: it required `canRunCommand()` and `doctor.ts` (which are Layer 3 deliverables) as Layer 3 prerequisites. Fixed by:

- **Layer 2** = all bug fixes, including `canRunCommand()` helper and any other building blocks needed for bug fixes. `canRunCommand()` is part of Bug A fix.
- **Layer 3** = ScoutDefinition + registry + `examples/` + plugin docs + `/research:doctor` (which uses the registry).

**Two distinct gates:**

1. **Design approved for implementation** (this doc's goal): the design is internally consistent, every concern has an explicit resolution or v2 deferral, and the bug acceptance criteria are testable. Pass-6 onward.
2. **Release-ready** (later): all Layer 2 bug fixes (A, B, C, D, E, F, I) have **green** acceptance tests in CI. Only then can Layer 3 code merge. G/H/J are already green.

Doctor and registry are NOT release-gate prerequisites — they are Layer 3 outputs that consume the Layer 2 utilities.

**Layer 2 release-gate checklist (no Layer 3 items):**

- [x] Bug G: native IDs everywhere; `providerFromModel()` validates slash prefix against `KNOWN_PROVIDERS`; `tests/config/provider-from-model.test.ts` covers known slash, unknown slash (`openrouter/foo`), typos, native, unknown native
- [x] Bug H: regression test — design-doc without `alternatives.md` does not error
- [x] Bug J: project-scoped active thread; legacy fallback with project-membership check
- [ ] Bug A: `tests/state/command-policy.test.ts` runs every row of the state-examples table through `canRunCommand`; oracle/contract `customCheck` branches verified
- [ ] Bug D: integration test — oracle output file contains ≥1 quoted line from each of the doc's top-level sections (TL;DR, Goals, etc.); not just "≥3 headings"
- [ ] Bug I: integration test — `buildEvaluateInstruction` output contains zero substring matches for `mempalace_` when `config.mempalaceUrl` is unset; MemPalace HTTP client is never constructed (spied)
- [ ] Bug C: `tests/scouts/oss-tool-consistency.test.ts` — parses both `agents/research-oss-scout.md` frontmatter and `templates/prompts/scout-oss.md` body, asserts intersection non-empty and contradictory phrases absent
- [ ] Bug F: scope serialized as `string[]`; loader migrates legacy `string` → `[string]` on read; test covers both
- [ ] Bug B: integration test — running `/research:scout src/foo` causes "src/foo" to appear verbatim in the generated repo-scout prompt; multi-path variant also tested
- [ ] Bug E: with `mempalaceUrl` set, `buildMemPalaceClient` spy is called; without, spy is never called AND no `mempalace_` strings emit AND no MemPalace HTTP requests fire (network mock)
- [ ] Bug J edge cases: `tests/state/active-pointer.test.ts` covers corrupted JSON → null, symlinked projectRoot → realpath resolution, nested repos → nearest `.pi/deep-research/`

### Layer 1 — Unblock reuse (est. 4–8h implementation + 2h docs)

1. ~~Revert `src/config/models.ts`~~ — **Done** (native IDs kept; `providerFromModel()` updated).
2. ~~Add `dispatchModelId()`~~ — **Not needed** (native IDs used directly).
3. Add `src/config/schema.ts` (TypeBox) + `src/config/loader.ts` (four-layer resolution, lazy, session-cached).
4. Thread `config.user.name` through `src/docs/instructions.ts` (×4 replacements).
5. Guard `buildEvaluateInstruction` — call `mempalace_add_drawer` only when `config.mempalaceUrl` is set.
6. Add inline quick preflight to `/research:new` (calls doctor quick checks; surfaces any failures before thread setup).
7. Update `docs/SETUP.md` — remove private LAN URL; document all env vars; minimum viable setup (Anthropic-only, no MemPalace).
8. Update `README.md` — explain registry vs dispatch format; update model tier table.
9. Update `templates/prompts/grill-brief.md` — generic memory context section.

### Layer 2 — Bug fixes (est. 8–16h implementation + 2h tests)

Each fix is self-contained; apply in this order with acceptance test before moving on:

| Fix | Files | Acceptance test |
|---|---|---|
| **G** (model IDs) | `models.ts`, `providers.ts`, all `agents/*.md` | ✅ Done — native IDs everywhere; providerFromModel() infers from prefix; 97/97 tests pass |
| **H** (alternatives optional) | `adr.ts`, `rfc.ts`, `design-doc.ts`, `document.ts` | ✅ Done — regression test: design-doc without alternatives.md passes |
| **J** (global active-thread pointer) | `store.ts`, `index.ts`, `new.ts` | ✅ Done — project-local `active.json`; legacy fallback; project-membership check |
| **D** (oracle timing) | `oracle.ts`, `design-doc.ts`, `rfc.ts`, `prd.ts` | Oracle output contains ≥3 headings from doc |
| **A** (command policy) | `src/state/commands.ts`, all 14 handlers | Forward block + rerun allow + file-missing block |
| **I** (evaluate MemPalace) | `instructions.ts`, `evaluate.ts` | No MemPalace calls in instruction when unconfigured |
| **C** (OSS tool contradiction) | `scout-oss.md`, `research-oss-scout.md` | Both files list the same available tools |
| **F** (scope multi-select) | `new.ts` | Scope stores multi-value array |
| **B** (relevantPaths) | `scout.ts` | Arg passed to `buildRepoScoutSpec` |
| **E** (MemPalace wiring) | `new.ts`, `mempalace/client.ts` | Called with URL; skipped without |

### Layer 3 — Scout plugin contract (est. 3–5d implementation + 1d docs)

1. Create `src/scouts/types.ts` with `ScoutDefinition` interface + `SCOUT_API_VERSION = 1`.
2. Create `src/scouts/loader.ts` — two-stage loader (Stage 1: import + interface validation; Stage 2: availability probe with timeout); errors → DoctorCheck.
3. Migrate built-in scouts: `src/scouts/web/index.ts`, `src/scouts/oss/index.ts`, `src/scouts/repo/index.ts`; each exports `ScoutDefinition` with `scoutApiVersion: 1`.
4. Create `src/scouts/registry.ts` — load built-ins + `config.scouts[]` via loader; handle discovery syntax (built-in id, absolute path, project-relative); apply default roster policy (3 scouts when no `mempalaceUrl`).
5. Update `src/commands/scout.ts` to consume registry.
6. Extract memory scout → `examples/memory-mempalace/index.ts`; add `scoutApiVersion: 1`.
7. Add `examples/github-trends/index.ts` — bash/read only; no MCP; `scoutApiVersion: 1`.
8. Add `examples/*/README.md` with authoring guide and trust model.
9. Add `docs/CUSTOM-SCOUTS.md` — full guide: discovery syntax, scoutApiVersion, two-stage loading, plugin-specific config not supported (use env vars), testing, troubleshooting.
10. Implement `src/commands/doctor.ts` with `--quick`, `--deep`, `--json` modes and exit codes 0/1/2.
11. Implement `src/state/commands.ts` (`canRunCommand()`) with state-examples coverage.
12. Update `src/index.ts` — lazy config load + scout registry at first command.
13. Add `scripts/smoke-no-memory.ts` and `scripts/smoke-doctor-json.ts`; register as `bun run smoke:*` in `package.json`.

---

## Docs deliverables checklist

- [ ] `README.md` — no private infra; registry vs dispatch format explained; minimum viable setup
- [ ] `docs/SETUP.md` — all env vars; no hardcoded URLs; Anthropic-only quickstart; troubleshooting section
- [ ] `docs/CONFIG.md` — full TypeBox schema reference; resolution order; merge semantics; unknown-key policy
- [ ] `docs/CUSTOM-SCOUTS.md` — `ScoutDefinition` guide; trust model; `isAvailable()` contract; testing; loading
- [ ] `docs/COMMANDS.md` — command precondition matrix; phase diagram; oracle gate explanation; doctor modes
- [ ] `examples/memory-mempalace/README.md` — MemPalace scout as reference; annotated `ScoutDefinition`
- [ ] `examples/github-trends/README.md` — minimal scout; bash/read only; no MCP; easiest onboarding path
- [ ] `CHANGELOG.md` — generalization changes; model-ID format contract; scout plugin API version
- [ ] `scripts/smoke-no-memory.ts` — end-to-end smoke test (no MemPalace, Anthropic-only); runs as `bun run smoke:no-memory`
- [ ] `scripts/smoke-doctor-json.ts` — asserts doctor --json exit codes and check IDs; runs as `bun run smoke:doctor-json`

---

## Predicted KPIs

| KPI | Baseline | Target | Measurement |
|---|---|---|---|
| New user onboarding | Requires fork + identity fix | Scripted smoke test passes in < 10 min (no MemPalace, Anthropic-only, clean checkout) | CI job: `docker run clean-checkout && pi research:new` |
| Custom scout time | Requires fork + code changes | < 30 min from reading `CUSTOM-SCOUTS.md` to first scout running | Dogfood: timed with github-trends example |
| Dependency failures | Silent mid-run | All: `DoctorCheck` with status + remedy; `/research:new` surfaces quick check results inline | Integration test: disable each dep; assert DoctorCheck present |
| Phase guard consistency | 0/14 commands use policy | 14/14 call `canRunCommand()`; rerun tests pass | `grep -r "canRunCommand" src/commands/` returns 14; policy table CI test |
| Oracle gate iv content | Reviews `_Document not found._` | Oracle output references ≥1 quoted line from each top-level section of the reviewed doc (TL;DR, Goals, etc.) | Integration test parses oracle markdown, extracts quoted lines, asserts coverage per section |
| Config portability | Author's machine only | Works in CI with env vars only; works with US-regional OpenAI endpoint | CI matrix: `anthropic-only`, `openai-regional`, `google-only`; `Value.Default` test for empty config |
| MemPalace-free operation | MemPalace called unconditionally | Full `new→scout→groom→design-doc→evaluate` with no `mempalaceUrl`: (a) `buildMemPalaceClient` spy NEVER called, (b) no MCP tools matching `mempalace_*` invoked, (c) no `mempalace.*` HTTP requests (network mock asserts) | `bun run smoke:no-memory` — three-layer assertion (spy + tool registry + network mock) |
| Provider dispatch correctness | Broken — OpenRouter prefixes in agent profiles and models.ts | ✅ Fixed — native IDs everywhere; `providerFromModel()` infers from prefix; 97/97 tests pass | CI: `bun run test` |
| Doctor machine-readability | No structured output | `doctor --json` exits 0/1/2; stable check IDs parseable in CI | `bun run smoke:doctor-json` asserts exit code + required check IDs present |
| Scout API compatibility | No version field | New scouts declare `scoutApiVersion: 1`; incompatible scouts excluded with clear message | `tests/scouts/registry.test.ts` — wrong major version excluded; minor warns |

---

## Deferred to v2 (explicit non-goals for this design)

These items are **acknowledged limitations of v1** and are deferred to a later design pass. They are out of scope for this doc.

| Deferred | Reason | Workaround for v1 users |
|---|---|---|
| npm package scouts (`scouts: ["pi-research-scout-foo"]`) | Plugin distribution mechanism + version compatibility matrix not yet stable | Vendor the scout file into the project and use a local path |
| Plugin scaffold generator (`/research:scout init`) | Templating + smoke-test scaffolding belongs in a later DX pass | Copy `examples/github-trends/` as a starting template |
| Sandboxed plugin execution | Out of scope — trust model is "operator's machine" | Only load scouts from sources you trust |
| Cross-project shared scout cache | No clear UX yet; adds complexity | Each project's `.pi/deep-research/config.json` is independent |
| Network checks in doctor (live API ping) | Slow; better as opt-in `--probe-network` flag in a later pass | Run `/research:new` to surface real auth/connectivity issues |
| `scouts: []` to disable all scouts | Footgun in v1 (operators may set it to debug) | Omit `scouts` key entirely for defaults |
| Plugin migration on `scoutApiVersion` mismatch | No migration path defined | Update the scout to current API version |
| Workflow state recovery (interrupted commands) | Beyond `requiredAll` file checks | Manually clean up partial files; `requiredAll` catches missing-output cases |
| Hot reload of `config.scouts[]` | Init is cached by config path (not session); reload requires modifying or switching the config file | Edit config and switch projects, or restart pi |
| Killable child-process scout execution | True isolation requires child-process orchestration; out of scope for v1 trust model | Use `allowExternalScouts: false` + trusted workspaces |
| `config.providers` override (custom credentials for OpenRouter/Azure/Ollama) | Provider override schema not designed yet | Set the provider's documented env var; doctor will warn (`credential.unknown.<id>`) |
| Windows-only test matrix | v1 ships cross-platform via `which` npm package + `PATHEXT`; Windows-specific tests not in CI yet | Cross-platform code path tested; Windows-specific CI runner deferred |

The release gate **does not block on any of these items**. They are tracked in `CHANGELOG.md` under "Roadmap: v2".

---

## References

- `research/001-how-to-improve-this-extenssion-to-be-suitable-for-more-scope/synthesis.md`
- `research/001-how-to-improve-this-extenssion-to-be-suitable-for-more-scope/raw/` (all scouts)
- `research/001-how-to-improve-this-extenssion-to-be-suitable-for-more-scope/oracle/after-doc.md`
- OSS reference: https://github.com/assafelovic/gpt-researcher
- OSS reference: https://github.com/stanford-oval/storm
- OSS reference: https://github.com/langchain-ai/open_deep_research
