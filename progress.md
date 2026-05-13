# Progress

## Status
In Progress

## Tasks

### Layer 2 Bug Fixes

- [x] **Bug C** — OSS scout tool alignment: added `librarian` to `tools:` in agent profile; updated description and systemPrompt to mention both `librarian` (code search) and `gh` CLI (repo stats/structure); updated prompt template to document both approaches
- [x] **Bug D** — Oracle doc-exists guard: added `stat()` check in `after-doc` gate to verify linked doc is on disk before dispatching oracle; added empty-context guard to catch `_Document not found._` / `_No context files found._` sentinel strings before dispatch
- [x] **Bug E** — Memory scout conditional: `runScout()` now loads project config; dispatches memory scout only when `config.mempalaceUrl` is set; default roster = web, oss, repo (3 scouts)
- [x] **Bug I** — Evaluate mempalace guard: `buildEvaluateInstruction()` accepts optional `mempalaceUrl`; when absent, step 4 says "MemPalace not configured, skip"; when present, calls `mempalace_add_drawer` as before
- [x] **Bug B** — `relevantPaths` wired: `runScout()` now parses space-separated args and passes to `buildRepoScoutSpec` instead of hardcoded `[]`; notify message shows paths when provided
- [x] **Bug F** — Scope label fixed: changed misleading "select all that apply" label to "Research scope (primary):" — pi API has no `multiSelect`, only `select`
- [x] **Layer 1 (M1)** — Hardcoded author removed: `src/docs/instructions.ts` no longer contains `"Ruslan Kurchenko"`; all 4 template call sites now use `resolveAuthorName(ctx.projectRoot)` which reads `git config user.name`

## Files Changed

- `agents/research-oss-scout.md` — tools: bash, read → bash, read, librarian; description and body updated
- `templates/prompts/scout-oss.md` — added dual-approach section (librarian + gh CLI)
- `src/commands/oracle.ts` — disk-existence check + empty-context guard
- `src/config/config.ts` — new: DeepResearchConfig interface + loadConfig()
- `src/docs/instructions.ts` — buildEvaluateInstruction gains optional mempalaceUrl param [bug-I]
- `src/commands/scout.ts` — conditional memory scout dispatch [bug-E]
- `src/commands/evaluate.ts` — passes config.mempalaceUrl to buildEvaluateInstruction
- `tests/scouts/oss-alignment.test.ts` — [bug-C] 4 tests
- `tests/commands/oracle-guard.test.ts` — [bug-D] 2 tests
- `tests/config/config.test.ts` — 4 loadConfig tests
- `tests/docs/evaluate-instruction.test.ts` — [bug-I] 5 tests
- `~/.pi/agent/agents/research-oss-scout.md` — installed copy updated

## Notes

- 129/129 tests pass (up from 97 baseline; parallel agents added more tests)
- `vi.stubEnv` Bun incompatibility in `providers.test.ts` fixed — replaced with direct `process.env` manipulation
- Bugs remaining open: none in this batch — all 7 Layer 2 bugs now fixed
- Metric M1 gate confirmed: `grep -rn '"Ruslan Kurchenko"' src/` returns 0
