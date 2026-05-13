# Progress

## Status
In Progress

## Tasks

### Layer 2 Bug Fixes

- [x] **Bug C** — OSS scout tool alignment: added `librarian` to `tools:` in agent profile; updated description and systemPrompt to mention both `librarian` (code search) and `gh` CLI (repo stats/structure); updated prompt template to document both approaches
- [x] **Bug D** — Oracle doc-exists guard: added `stat()` check in `after-doc` gate to verify linked doc is on disk before dispatching oracle; added empty-context guard to catch `_Document not found._` / `_No context files found._` sentinel strings before dispatch

## Files Changed

- `agents/research-oss-scout.md` — tools: bash, read → bash, read, librarian; description and body updated
- `templates/prompts/scout-oss.md` — added dual-approach section (librarian + gh CLI)
- `src/commands/oracle.ts` — disk-existence check + empty-context guard
- `tests/scouts/oss-alignment.test.ts` — [bug-C] 4 tests
- `tests/commands/oracle-guard.test.ts` — [bug-D] 2 tests
- `~/.pi/agent/agents/research-oss-scout.md` — installed copy updated

## Notes

- 5 pre-existing `checkProvider` test failures (vi.stubEnv not in this Vitest version) — not regressions
- 107 tests pass (up from 97 baseline)
