# GitHub Trending Scout Task

## Research brief
{{brief}}

## Instructions

1. Search for repositories related to the brief topics:
   ```bash
   gh search repos "<topic>" --sort=stars --limit=20
   ```

2. For the top 5 most relevant repositories, inspect their structure:
   ```bash
   gh repo view <owner/repo> --json description,stargazerCount,topics,updatedAt
   ```

3. Read key source files to understand architectural patterns (use `read` tool or `gh` CLI).

4. Write findings to the output file specified in the task.

## Output format

Start with YAML frontmatter (the host will prepend it), then:

## Trending repos

For each relevant repo:

**[repo-name](https://github.com/owner/repo)** — N ⭐
- Architecture pattern: ...
- Relevant to brief because: ...
- Key files inspected: ...
- Confidence: high / medium / low

## Summary

What patterns emerged across these repos that are relevant to the brief?
