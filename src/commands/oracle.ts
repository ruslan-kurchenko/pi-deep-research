import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readOptional } from "../lib/files.js";
import { threadDir } from "../lib/paths.js";
import { buildOracleInstruction, buildOracleContext, ensureOracleDir, type OracleGate } from "../docs/oracle.js";
import { resolveAgentModel } from "../config/models.js";
import { resolveWithFallback } from "../config/fallback.js";
import { getThread, logModelUsage, logOracleReview } from "../state/store.js";

const VALID_GATES: OracleGate[] = ["after-alternatives", "after-doc"];

function gateFromPhase(phase: string): OracleGate {
  return phase === "alternatives" ? "after-alternatives" : "after-doc";
}

export async function runOracle(
  args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  projectRoot: string,
  activeThreadId: string
): Promise<void> {
  const thread = await getThread(projectRoot, activeThreadId);
  if (!thread) { ctx.ui.notify(`No active thread: ${activeThreadId}`, "error"); return; }

  // Determine gate from arg or current phase
  const gateArg = args.trim() as OracleGate | "";
  const gate: OracleGate = VALID_GATES.includes(gateArg as OracleGate)
    ? (gateArg as OracleGate)
    : gateFromPhase(thread.phase);

  const dir = threadDir(projectRoot, activeThreadId);

  // Gate-specific prerequisite check
  if (gate === "after-alternatives") {
    const alt = await readOptional(join(dir, "alternatives.md"));
    if (!alt) {
      ctx.ui.notify("alternatives.md not found. Run /research:alternatives first.", "error");
      return;
    }
  } else {
    // after-doc: need at least one linked doc
    const linked = thread.linkedDocs;
    const hasDoc = linked.designDoc ?? linked.rfc ?? linked.adr?.[0];
    if (!hasDoc) {
      ctx.ui.notify("No linked doc found. Run /research:rfc, /research:design-doc, or /research:prd first.", "error");
      return;
    }
  }

  const brief = (await readOptional(join(dir, "brief.md"))) ?? thread.topic;

  // Resolve oracle model
  const defaultModel = await resolveAgentModel("research-oracle", projectRoot);
  const oracleModel = await resolveWithFallback(
    defaultModel, "research-oracle", ctx, projectRoot, activeThreadId
  );

  // Build gate-specific context
  const linked = thread.linkedDocs;
  const linkedDocPath =
    gate === "after-doc"
      ? (linked.designDoc ?? linked.rfc ?? linked.adr?.[0])
      : undefined;

  const contextMd = await buildOracleContext(dir, gate, linkedDocPath);

  await ensureOracleDir(dir);

  // Log model usage + pre-record oracle review entry
  const now = new Date().toISOString();
  await logModelUsage(projectRoot, activeThreadId, {
    agent: "research-oracle",
    model: oracleModel,
    command: `oracle:${gate}`,
    timestamp: now,
  });
  await logOracleReview(projectRoot, activeThreadId, {
    gate,
    outputPath: join(dir, "oracle", `${gate}.md`),
    timestamp: now,
  });

  ctx.ui.notify(`Dispatching oracle (${oracleModel}) at gate: ${gate}…`, "info");

  pi.sendUserMessage(
    await buildOracleInstruction(
      { threadId: activeThreadId, threadDir: dir, gate, brief, oracleModel },
      contextMd
    ),
    { deliverAs: "followUp" }
  );
}
