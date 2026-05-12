# Setup Guide

## 1. Install the extension

```bash
# From local clone (development)
pi install ./

# Or add to ~/.pi/agent/settings.json
```

```json
{
  "extensions": ["/Users/ruslan.kurchenko_1/Projects/personal/pi-deep-research/src/index.ts"]
}
```

## 2. Install required dependencies

```bash
pi install npm:pi-mcp-adapter
pi install npm:pi-subagents
pi install npm:pi-librarian
# optional: video/YouTube research
pi install npm:pi-web-access
```

## 3. Configure MCP servers for pi-mcp-adapter

Create `~/.config/mcp/mcp.json` (or `~/.pi/agent/mcp.json`):

```json
{
  "mcpServers": {
    "mempalace": {
      "type": "streamable-http",
      "url": "http://100.67.90.25:8080/mcp"
    },
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server", "tools=web_search_exa,get_code_context_exa"]
    },
    "context7": {
      "type": "streamable-http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "<your-key>"
      }
    }
  }
}
```

## 4. Install agent profiles

```bash
cp agents/*.md ~/.pi/agent/agents/
```

## 5. Langfuse (optional, for /research:evaluate)

```bash
export LANGFUSE_BASE_URL="https://cloud.langfuse.com"
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_SECRET_KEY="sk-lf-..."
```

## 6. Verify

```
/research:status
```

Should respond: "No research threads. Start with /research:new <topic>."

## Workflow quick-start

```
/research:new "voice stack north star: vapi vs direct twilio, model selection, dead-air latency"
/research:scout
/research:groom
/research:alternatives
/research:document     ← recommends format, then routes
/research:contract
# ... ship the change ...
/research:evaluate
```
