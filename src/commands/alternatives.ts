import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir } from "../lib/paths.js";
import {
  buildAlternativesInstruction,
  buildRubricPrompt,
} from "../synthesis/instructions.js";
import { loadRubric, saveRubric } from "../synthesis/rubric.js";
import { resolveAgentModels } from "../config/models.js";
import { resolveWithFallback } from "../config/fallback.js";
import { getThread, updateThreadPhase, logModelUsage } from "../state/store.js";

export async function runAlternatives(
  _args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  projectRoot: string,
  activeThreadId: string
): Promise<void> {
  const thread = await getThread(projectRoot, activeThreadId);
  if (!thread) {
    ctx.ui.notify(`No active thread: ${activeThreadId}`, "error");
    return;
  }

  const dir = threadDir(projectRoot, activeThreadId);

  // Require synthesis.md
  const synthesis = await readOptional(join(dir, "synthesis.md"));
  if (!synthesis) {
    ctx.ui.notify(
      "synthesis.md not found. Run /research:groom first.",
      "error"
    );
    return;
  }

  if (thread.phase !== "groom" && thread.phase !== "alternatives") {
    const ok = await ctx.ui.confirm(
      "Re-run alternatives?",
      `Thread is in phase '${thread.phase}'. Overwrite alternatives.md and cross-checks?`
    );
    if (!ok) return;
  }

  const brief = (await readOptional(join(dir, "brief.md"))) ?? thread.topic;

  // Load or ask for rubric
  let rubric = await loadRubric(dir);
  if (!rubric) {
    const prompt = buildRubricPrompt(thread.scope);
    const answer = await ctx.ui.input("Define scoring rubric", prompt);
    if (answer && answer.toLowerCase() !== "use the suggestions") {
      rubric = answer;
      await saveRubric(dir, rubric);
    }
    // null rubric → instruction will ask the LLM to prompt operator inline
  }

  // Resolve cross-check models
  const defaults = await resolveAgentModels(
    ["research-challenger", "research-devils-advocate"],
    projectRoot
  );
  const challengerModel = await resolveWithFallback(
    defaults["research-challenger"] as string, "research-challenger", ctx, projectRoot, activeThreadId
  );
  const devilsModel = await resolveWithFallback(
    defaults["research-devils-advocate"] as string, "research-devils-advocate", ctx, projectRoot, activeThreadId
  );

  await updateThreadPhase(projectRoot, activeThreadId, "alternatives");
  const now = new Date().toISOString();
  await logModelUsage(projectRoot, activeThreadId, { agent: "research-challenger", model: challengerModel, command: "alternatives", timestamp: now });
  await logModelUsage(projectRoot, activeThreadId, { agent: "research-devils-advocate", model: devilsModel, command: "alternatives", timestamp: now });

  ctx.ui.notify(
    `Dispatching alternatives matrix + cross-checks…\n  challenger + devils-advocate → ${challengerModel}`,
    "info"
  );

  pi.sendUserMessage(
    buildAlternativesInstruction(activeThreadId, dir, brief, synthesis, rubric, challengerModel, devilsModel),
    { deliverAs: "followUp" }
  );
}
