# Progress

## Status
Layer 3 in progress (Worker 2 complete)

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

## In Progress
- Worker 1: registry + ensureInitialized + trust boundary
- Worker 3: Doctor command
- Worker 4: Plugin contract tests (M4) + smoke scripts + config schema

## Notes
- Existing `src/scouts/web.ts`, `oss.ts`, `repo.ts` left intact — still used by `runScout()`
- Built-in scout modules use `fileURLToPath(new URL(..., import.meta.url))` for portable paths
- examples/ not in tsconfig.json include — they import from `../../src/scouts/types.js` directly
