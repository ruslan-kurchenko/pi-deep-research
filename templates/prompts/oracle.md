# Oracle Review Task

You are the `research-oracle` agent. Apply your full meta-cognitive process and mandatory output schema to the context below.

## Gate
{{gate}}

## Research brief
{{brief}}

{{context_section}}

## Output path
Write your complete review to: `{{output_path}}`

Prepend YAML frontmatter:
```yaml
---
agent: research-oracle
model: {{model}}
gate: {{gate}}
thread_id: {{thread_id}}
generated_at: {{generated_at}}
---
```

## Reminder: mandatory sections
Your output MUST contain all of these sections in order. No exceptions.
1. Verdict (APPROVE / REVISE / REJECT + confidence score)
2. Decomposition (Step 1 — your own restatement of the problem)
3. Per-claim audit table (Step 3)
4. Concerns ranked by severity × confidence
5. Missing alternatives
6. Hidden assumptions
7. Suggested actions (checkboxes, each completable in < 1 day)
8. Calibration check (Step 5)

Write `NONE FOUND` in any section where you have no findings. Never skip a section.
