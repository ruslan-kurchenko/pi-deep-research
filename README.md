# pi-deep-research

Deep-research workflow extension for [pi](https://github.com/badlogic/pi-mono).

Turns ad-hoc "go research this" into a repeatable, sellable artifact pipeline:
parallel scouts → synthesis with confidence scoring → grooming with the operator →
ranked alternatives matrix → ADR / RFC / Design Doc / PRD → measurement contract →
post-implementation evaluation.

**Status:** pre-MVP. See [`docs/plans/`](docs/plans/) for the implementation plan.

## Why

Most "AI research" output is a blob of confident text. This extension produces
artifacts your team can actually approve, ship against, and measure later:

- Research dossiers stay local (gitignored).
- Decisions (ADR / RFC / Design Doc / PRD) get committed with C4 diagrams and KPI contracts.
- Predicted KPIs are stored as a measurement contract.
- Post-implementation, the extension closes the loop: predicted vs. actual.

## Composition

`pi-deep-research` is workflow glue. It stands on:

| Dep | Role |
|---|---|
| [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter) | One proxy tool for MemPalace, Exa, Context7, Linear MCPs |
| [`pi-subagents`](https://github.com/nicobailon/pi-subagents) | Parallel/chain/background scout orchestration |
| [`pi-librarian`](https://github.com/default-anton/pi-librarian) | GitHub-focused recon subagent |
| [`pi-web-access`](https://github.com/nicobailon/pi-web-access) | Optional: YouTube/video understanding for talks |

Memory: [MemPalace](https://mempalaceofficial.com) (project + global wings) via MCP.

## License

MIT
