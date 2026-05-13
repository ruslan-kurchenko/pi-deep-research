# Progress

## Status
Layer 3 in progress — Worker 3 (/research:doctor) complete

## Layer 2 — Complete ✅ (135 tests)
- Bug A: `canRunCommand()` + `COMMAND_POLICIES` table + `guardCommand` wired in index.ts
- Bug B: `relevantPaths` parsed from scout args
- Bug C: OSS scout tool alignment (librarian + gh)
- Bug D: Oracle doc-exists guard
- Bug E: Conditional memory scout dispatch via `loadConfig`
- Bug F: Scope label fixed, stored as `string[]`
- Bug I: `buildEvaluateInstruction` conditional mempalace step
- Layer 1: Hardcoded author removed from `src/docs/instructions.ts`

## Layer 3 — In Progress

### Worker 3: /research:doctor — DONE ✅
- `src/commands/doctor.ts`: `buildDoctorReport()` + `runDoctor()`
  - Quick mode: config.parse, credential.<provider>, dir.research.writable, dir.docs.writable
  - Deep mode: scout env checks + registry placeholder
  - Exit codes: 0=ok, 1=warn, 2=error
  - `--json` flag for machine-readable output
- `src/config/config.ts`: added `allowExternalScouts?: boolean`
- `src/state/tracker.ts`: added `"doctor"` to `ResearchCommand` + `COMMAND_POLICIES`
- `src/index.ts`: registered `/research:doctor` command
- `tests/commands/doctor.test.ts`: 14 tests
- `tests/extension.smoke.test.ts`: updated count 13→15
- **Total tests: 158/158 passing**

### Worker 1: ScoutDefinition types + registry — status unknown
### Worker 2: Built-in scout modules + examples — status unknown
### Worker 4: Plugin contract tests + smoke scripts — status unknown

## Files Changed
- src/commands/doctor.ts (new)
- src/config/config.ts (allowExternalScouts added)
- src/state/tracker.ts (doctor command added)
- src/index.ts (doctor registered)
- tests/commands/doctor.test.ts (new, 14 tests)
- tests/extension.smoke.test.ts (count 13→15, doctor added)
- progress.md (this file)
