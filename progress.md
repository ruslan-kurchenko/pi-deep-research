# Progress

## Status
Layer 3 in progress (Workers 2 + 3 + 4 complete; Worker 1 registry pending merge)

## Completed

### Layer 2 (all bugs fixed, 135 tests)
- Bug A: `canRunCommand()` + `COMMAND_POLICIES` + guardCommand wired
- Bug B: `relevantPaths` parsed from scout args
- Bug C: OSS scout tool alignment (librarian + gh)
- Bug D: Oracle doc-exists guard
- Bug E: Conditional memory scout dispatch (config.mempalaceUrl)
- Bug F: Scope label fixed, stored as string[]
- Bug I: `buildEvaluateInstruction` mempalace guard

### Layer 3 — Worker 2 (built-in modules + examples)
- `src/scouts/types.ts` — `ScoutDefinition` interface + `SCOUT_API_VERSION = 1`
- `src/scouts/web/index.ts` — web scout as ScoutDefinition
- `src/scouts/oss/index.ts` — OSS scout as ScoutDefinition (gh + librarian)
- `src/scouts/repo/index.ts` — repo scout as ScoutDefinition
- `examples/memory-mempalace/index.ts` — memory example (mempalaceUrl guard)
- `examples/github-trends/index.ts` — simpler onboarding example (gh only)
- `examples/github-trends/agent.md` + `prompt.md` + `README.md`
- `examples/memory-mempalace/README.md`
- `tests/scouts/builtin-scouts.test.ts` — 42 tests, all passing
- 198/198 full suite green

### Layer 3 — Worker 3 (Doctor command)
- `src/commands/doctor.ts` — `buildDoctorReport()`, quick/deep modes, --json, exit codes 0/1/2
- Registered as `/research:doctor` in `src/index.ts`
- `COMMAND_POLICIES` entry for `research:doctor` (any phase, allowRerun: true)
- Tests: `tests/commands/doctor.test.ts` — credential scoping, config.parse, exit codes

### Layer 3 — Worker 4 (M4 tests + smoke scripts)
- `src/scouts/types.ts` — appended `normalizeAvailability()` + `validateScoutInterface()` helpers
- `tests/scouts/plugin.test.ts` — 9 contract tests (Metric M4), all passing
- `scripts/smoke-no-memory.mjs` — 4 checks (Metric M2), exit 0
- `scripts/smoke-doctor-json.mjs` — 8 checks across 3 scenarios (Metric M5), exit 0
- `package.json` — added `smoke:no-memory` and `smoke:doctor-json` scripts
- Config schema already complete (Worker 1 added `allowExternalScouts` + `scouts`)

## In Progress
- Worker 1: registry + ensureInitialized + trust boundary (pending merge)

## Open Gaps
- `DoctorReport.scoutRoster` field from design doc not in Worker 3's implementation
  → smoke-doctor-json.mjs checks `configSummary.loadedScouts` instead; tracked for follow-up
- Worker 1 registry (`src/scouts/registry.ts`) not yet merged; `runScout()` still uses old spec builders directly

## Notes
- Existing `src/scouts/web.ts`, `oss.ts`, `repo.ts` left intact — still used by `runScout()`
- Built-in scout modules use `fileURLToPath(new URL(..., import.meta.url))` for portable paths
- examples/ not in tsconfig.json include — they import from `../../src/scouts/types.js` directly
