import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runNew } from "./commands/new.js";
import { runScout } from "./commands/scout.js";
import { runStatus, runResume } from "./commands/status.js";
import { getActiveThread } from "./state/store.js";

const GLOBAL_STATE_DIR = join(process.env["HOME"] ?? "~", ".pi", "agent", "state");

/** Derive the project-specific MemPalace wing name from the project directory. */
function inferProjectWing(cwd: string): string {
  const parts = cwd.replace(/\/$/, "").split("/");
  const name = parts[parts.length - 1] ?? "project";
  return `project-${name}`;
}

export default function piDeepResearch(pi: ExtensionAPI) {
  // ── /research:new ─────────────────────────────────────────────────────────
  pi.registerCommand("research:new", {
    description: "Start a new research thread (grill-me brief + scope)",
    handler: async (args, ctx) => {
      await runNew(args ?? "", ctx, ctx.cwd);
    },
  });

  // ── /research:scout ───────────────────────────────────────────────────────
  pi.registerCommand("research:scout", {
    description: "Dispatch parallel scouts (web, OSS, repo, memory)",
    handler: async (args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) {
        ctx.ui.notify("No active thread. Run /research:new first.", "error");
        return;
      }
      await runScout(
        args ?? "",
        ctx,
        pi,
        ctx.cwd,
        activeId,
        inferProjectWing(ctx.cwd)
      );
    },
  });

  // ── /research:groom ───────────────────────────────────────────────────────
  pi.registerCommand("research:groom", {
    description: "Interactive synthesis + grooming session on raw findings",
    handler: async (_args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      // Phase 2 — stub for now, signals to LLM what to do
      pi.sendUserMessage(
        `Run /research:groom on thread ${activeId}.\n` +
        `Read all files in research/${activeId}/raw/ then:\n` +
        `1. Conduct a meta-cognitive synthesis (5-step: decompose/solve/verify/synthesize/reflect)\n` +
        `2. Ask me targeted clarifying questions based on gaps in the findings\n` +
        `3. Write the result to research/${activeId}/synthesis.md\n` +
        `Include confidence scores (0.0-1.0) per claim.`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:alternatives ────────────────────────────────────────────────
  pi.registerCommand("research:alternatives", {
    description: "Produce ranked alternatives matrix (1-5 options + do-nothing)",
    handler: async (_args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      pi.sendUserMessage(
        `Run /research:alternatives on thread ${activeId}.\n` +
        `Read research/${activeId}/synthesis.md and research/${activeId}/brief.md then:\n` +
        `1. Identify the rubric dimensions (or ask me to define them)\n` +
        `2. Generate 1-5 alternatives PLUS "do nothing" as the baseline\n` +
        `3. Score each alternative on each dimension\n` +
        `4. Write the matrix to research/${activeId}/alternatives.md\n` +
        `5. Run research-challenger and research-devils-advocate in parallel against the matrix\n` +
        `6. Write their outputs to research/${activeId}/cross-checks/\n` +
        `7. Present the final ranked recommendation to me and ask for confirmation.`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:document (smart router) ────────────────────────────────────
  pi.registerCommand("research:document", {
    description: "Recommend and route to the right doc format (ADR/RFC/Design Doc/PRD)",
    handler: async (_args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      pi.sendUserMessage(
        `Run /research:document on thread ${activeId}.\n` +
        `Read research/${activeId}/brief.md and research/${activeId}/alternatives.md then:\n` +
        `1. Use the research-doc-advisor agent to recommend the right document format\n` +
        `2. Present the recommendation + rationale to me\n` +
        `3. Ask me to confirm or choose a different format\n` +
        `4. Then run the appropriate /research:adr, /research:rfc, /research:design-doc, or /research:prd command`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:adr ─────────────────────────────────────────────────────────
  pi.registerCommand("research:adr", {
    description: "Produce an Architecture Decision Record from the alternatives",
    handler: async (args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      const title = (args ?? "").trim() || "untitled";
      pi.sendUserMessage(
        `Run /research:adr "${title}" on thread ${activeId}.\n` +
        `Read research/${activeId}/alternatives.md and research/${activeId}/synthesis.md then:\n` +
        `1. Use the ADR template at templates/adr.md\n` +
        `2. Fill in all {{placeholders}}\n` +
        `3. Write to docs/decisions/adrs/ with the next available NNN prefix\n` +
        `4. Update research/${activeId}/.state.json linkedDocs.adr`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:rfc ─────────────────────────────────────────────────────────
  pi.registerCommand("research:rfc", {
    description: "Produce an RFC from the alternatives",
    handler: async (_args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      pi.sendUserMessage(
        `Run /research:rfc on thread ${activeId}.\n` +
        `Use the RFC template at templates/rfc.md. Write to docs/rfcs/.`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:design-doc ──────────────────────────────────────────────────
  pi.registerCommand("research:design-doc", {
    description: "Produce a Design Doc with C4 diagrams from the alternatives",
    handler: async (_args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      pi.sendUserMessage(
        `Run /research:design-doc on thread ${activeId}.\n` +
        `Use the Design Doc template at templates/design-doc.md.\n` +
        `Use the research-architect agent to generate C4 context + container diagrams in Mermaid.\n` +
        `Write to docs/design-docs/.`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:prd ─────────────────────────────────────────────────────────
  pi.registerCommand("research:prd", {
    description: "Produce a PRD citing linked ADRs/RFC/Design Doc",
    handler: async (_args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      pi.sendUserMessage(
        `Run /research:prd on thread ${activeId}.\n` +
        `Use the PRD template at templates/prd.md.\n` +
        `Reference all linked docs from research/${activeId}/.state.json.\n` +
        `Write to docs/prds/.`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:contract ────────────────────────────────────────────────────
  pi.registerCommand("research:contract", {
    description: "Write a measurement contract with predicted KPIs",
    handler: async (_args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      pi.sendUserMessage(
        `Run /research:contract on thread ${activeId}.\n` +
        `Use the research-kpi-architect agent and the measurement template at templates/measurement.md.\n` +
        `Write to docs/measurement/.`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:evaluate ────────────────────────────────────────────────────
  pi.registerCommand("research:evaluate", {
    description: "Post-implementation: compare predicted vs actual KPIs",
    handler: async (_args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      if (!activeId) { ctx.ui.notify("No active thread.", "error"); return; }
      pi.sendUserMessage(
        `Run /research:evaluate on thread ${activeId}.\n` +
        `Read the measurement contract from docs/measurement/.\n` +
        `Use the configured adapter (Langfuse or manual) to collect actuals.\n` +
        `Use the evaluation template at templates/evaluation.md.\n` +
        `Write the report to docs/evaluation/.\n` +
        `Then save the results to MemPalace via the mempalace_add_drawer MCP tool.`,
        { deliverAs: "followUp" }
      );
    },
  });

  // ── /research:status ──────────────────────────────────────────────────────
  pi.registerCommand("research:status", {
    description: "Show all research threads and their current phase",
    handler: async (args, ctx) => {
      const activeId = await getActiveThread(GLOBAL_STATE_DIR);
      await runStatus(args ?? "", ctx, ctx.cwd, activeId);
    },
  });

  // ── /research:resume ──────────────────────────────────────────────────────
  pi.registerCommand("research:resume", {
    description: "Switch the active research thread",
    handler: async (args, ctx) => {
      await runResume(args ?? "", ctx, ctx.cwd, GLOBAL_STATE_DIR);
    },
  });
}
