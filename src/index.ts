import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ensureAgentsInstalled } from "./lib/agents-installer.js";
import { runNew } from "./commands/new.js";
import { runScout } from "./commands/scout.js";
import { runGroom } from "./commands/groom.js";
import { runAlternatives } from "./commands/alternatives.js";
import { runDocument } from "./commands/document.js";
import { runAdr } from "./commands/adr.js";
import { runRfc } from "./commands/rfc.js";
import { runDesignDoc } from "./commands/design-doc.js";
import { runPrd } from "./commands/prd.js";
import { runOracle } from "./commands/oracle.js";
import { runContract } from "./commands/contract.js";
import { runEvaluate } from "./commands/evaluate.js";
import { runStatus, runResume } from "./commands/status.js";
import { getActiveThread } from "./state/store.js";

function inferProjectWing(cwd: string): string {
  const parts = cwd.replace(/\/$/, "").split("/");
  const name = parts[parts.length - 1] ?? "project";
  return `project-${name}`;
}

/** Resolve active thread or notify and bail. */
async function requireActive(
  ctx: Parameters<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>[1],
  label: string
): Promise<string | null> {
  const id = await getActiveThread(ctx.cwd);
  if (!id) {
    ctx.ui.notify(`No active thread. Run /research:new first.`, "error");
    return null;
  }
  return id;
}

export default function piDeepResearch(pi: ExtensionAPI) {
  // Install bundled agent profiles to ~/.pi/agent/agents/ on every load.
  // Idempotent — skips files that haven't changed.
  ensureAgentsInstalled().then(({ installed, updated }) => {
    if (installed.length > 0)
      console.log(`[pi-deep-research] Installed agents: ${installed.join(", ")}`);
    if (updated.length > 0)
      console.log(`[pi-deep-research] Updated agents: ${updated.join(", ")}`);
  }).catch(() => {
    // Non-fatal — user can copy agents manually per docs/SETUP.md
  });

  // ── /research:new ──────────────────────────────────────────────────────────
  pi.registerCommand("research:new", {
    description: "Start a new research thread — grill-me brief + scope selection",
    handler: async (args, ctx) => {
      await runNew(args ?? "", ctx, ctx.cwd);
    },
  });

  // ── /research:scout ────────────────────────────────────────────────────────
  pi.registerCommand("research:scout", {
    description: "Dispatch 4 parallel scouts (web, OSS, repo, memory)",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "scout");
      if (!id) return;
      await runScout(args ?? "", ctx, pi, ctx.cwd, id, inferProjectWing(ctx.cwd));
    },
  });

  // ── /research:groom ────────────────────────────────────────────────────────
  pi.registerCommand("research:groom", {
    description: "Synthesize scout findings + interactive grooming with operator",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "groom");
      if (!id) return;
      await runGroom(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:alternatives ─────────────────────────────────────────────────
  pi.registerCommand("research:alternatives", {
    description: "Generate ranked alternatives matrix + challenger + devil's advocate",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "alternatives");
      if (!id) return;
      await runAlternatives(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:document (smart router) ─────────────────────────────────────
  pi.registerCommand("research:document", {
    description: "Recommend the right doc format (ADR/RFC/Design Doc/PRD) then route",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "document");
      if (!id) return;
      await runDocument(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:adr ──────────────────────────────────────────────────────────
  pi.registerCommand("research:adr", {
    description: "Generate an Architecture Decision Record",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "adr");
      if (!id) return;
      await runAdr(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:rfc ──────────────────────────────────────────────────────────
  pi.registerCommand("research:rfc", {
    description: "Generate a multi-decision RFC",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "rfc");
      if (!id) return;
      await runRfc(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:design-doc ───────────────────────────────────────────────────
  pi.registerCommand("research:design-doc", {
    description: "Generate a Design Doc with C4 diagrams",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "design-doc");
      if (!id) return;
      await runDesignDoc(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:prd ──────────────────────────────────────────────────────────
  pi.registerCommand("research:prd", {
    description: "Generate a PRD citing linked ADRs/RFC/Design Doc",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "prd");
      if (!id) return;
      await runPrd(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:oracle ────────────────────────────────────────────────────────
  pi.registerCommand("research:oracle", {
    description: "Cross-family adversarial review via GPT-5.5 — callable at any phase",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "oracle");
      if (!id) return;
      await runOracle(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:contract ─────────────────────────────────────────────────────
  pi.registerCommand("research:contract", {
    description: "Write measurement contract with predicted KPIs + rollback criteria",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "contract");
      if (!id) return;
      await runContract(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:evaluate ─────────────────────────────────────────────────────
  pi.registerCommand("research:evaluate", {
    description: "Post-implementation: predicted vs actual KPIs → evaluation report",
    handler: async (args, ctx) => {
      const id = await requireActive(ctx, "evaluate");
      if (!id) return;
      await runEvaluate(args ?? "", ctx, pi, ctx.cwd, id);
    },
  });

  // ── /research:status ───────────────────────────────────────────────────────
  pi.registerCommand("research:status", {
    description: "Show all research threads and their current phase",
    handler: async (args, ctx) => {
      const activeId = await getActiveThread(ctx.cwd);
      await runStatus(args ?? "", ctx, ctx.cwd, activeId);
    },
  });

  // ── /research:resume ───────────────────────────────────────────────────────
  pi.registerCommand("research:resume", {
    description: "Switch active research thread",
    handler: async (args, ctx) => {
      await runResume(args ?? "", ctx, ctx.cwd, ctx.cwd);
    },
  });
}
