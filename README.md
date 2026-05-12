# pi-deep-research

A [pi coding agent](https://pi.dev) extension that runs structured research workflows: parallel scouts → meta-cognitive synthesis → alternatives matrix → cross-family oracle review → ADR / RFC / Design Doc / PRD with KPI contracts.

## Architecture

```
/research:new          Brief + scope definition (grill-me interview)
/research:scout        4 parallel scouts (web, OSS, repo, memory)
/research:groom        Synthesis + operator review
/research:alternatives Alternatives matrix + Gemini cross-checks + GPT oracle (gate iii)
/research:document     Smart format router (ADR / RFC / Design Doc / PRD)
/research:adr          Architecture Decision Record
/research:rfc          Multi-decision RFC + oracle (gate iv)
/research:design-doc   Design Doc with C4 diagrams + oracle (gate iv)
/research:prd          Project plan citing linked docs + oracle (gate iv)
/research:oracle       Standalone cross-family adversarial review (any phase)
/research:contract     Measurement contract with predicted KPIs
/research:evaluate     Post-implementation: predicted vs actual + MemPalace
/research:status       Show all threads and phases
/research:resume       Switch active thread
```

### Three-tier model diversity

| Tier | Role | Model |
|---|---|---|
| 1 | Scouts (web, memory) | `anthropic/claude-haiku-4.5` |
| 1 | Scouts (repo, OSS) + synthesis | `anthropic/claude-sonnet-4.6` |
| 2 | Cross-checks (challenger, devil's advocate) | `google/gemini-3.1-pro-preview` |
| 3 | Oracle review | `openai/gpt-5.5` |

## Install

### Prerequisites

```bash
# 1. Install pi
npm install -g @earendil-works/pi-coding-agent

# 2. Install pi-subagents (required — oracle + cross-checks run as subagents)
pi install npm:pi-subagents

# 3. Auth your providers (only the families you want to use)
pi   # then /login → Claude Pro/Max        (scouts, synthesis)
pi   # then /login → ChatGPT Plus/Pro      (oracle, GPT-5.5)
# For Gemini (cross-checks), set env var:
export GEMINI_API_KEY=<your-key-from-aistudio.google.com>
```

### Install the extension

```bash
# From GitHub (recommended)
pi install git:github.com/ruslan-kurchenko/pi-deep-research

# Pin a specific version
pi install git:github.com/ruslan-kurchenko/pi-deep-research@v0.1.0

# Or run without installing (try first)
pi -e git:github.com/ruslan-kurchenko/pi-deep-research
```

Agent profiles are installed automatically to `~/.pi/agent/agents/` when the extension first loads.

### Project-level install (share with team)

```bash
pi install -l git:github.com/ruslan-kurchenko/pi-deep-research
```

This writes to `.pi/settings.json` so teammates get the extension automatically when they run pi in the repo.

## Usage

```bash
cd ~/Projects/my-project
pi

# Start a research thread
/research:new Why should we migrate from REST to GraphQL?

# Run scouts (reads from brief.md, dispatches 4 parallel agents)
/research:scout

# Synthesize findings, review with you
/research:groom

# Generate alternatives matrix + Gemini cross-checks + GPT oracle
/research:alternatives

# Route to the right document format, or call directly
/research:design-doc

# Measurement contract + evaluation
/research:contract
/research:evaluate
```

## Directory layout

```
research/                       ← gitignored (raw research artifacts)
  001-why-graphql/
    brief.md
    .state.json                 ← thread state + model audit log
    raw/                        ← scout outputs (with model frontmatter)
    synthesis.md
    alternatives.md
    rubric.md
    cross-checks/
      challenger.md             ← Gemini
      devils-advocate.md        ← Gemini
    oracle/
      after-alternatives.md     ← GPT oracle
      after-doc.md
docs/                           ← committed (final artifacts)
  decisions/adrs/
  rfcs/
  design-docs/
  prds/
  measurement/
  evaluation/
```

## Per-project model overrides

Create `.pi/deep-research/models.json` to override any agent's model:

```json
{
  "agents": {
    "research-oracle": "openai/o3",
    "research-challenger": "google/gemini-2.5-pro"
  }
}
```

Commit this file — it represents team consensus on model choices. If a configured provider isn't available, the extension prompts you before falling back.

## Optional: MemPalace memory

Install [MemPalace](https://mempalaceofficial.com) MCP and configure in `~/.pi/agent/mcp.json`:

```json
{
  "mcpServers": {
    "mempalace": {
      "url": "http://<your-server>/mcp"
    }
  }
}
```

The memory scout queries MemPalace for prior context. The evaluate command saves findings back.

## License

MIT
