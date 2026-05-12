import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { checkProvider, providerFromModel } from "./providers.js";
import { FALLBACK_CHAIN } from "./models.js";
import { getThread, updateThreadFallbacks } from "../state/store.js";

/**
 * Resolve a model string — checking provider availability.
 * Policy C: if unavailable, ask operator once per provider per thread,
 * cache their answer, use the fallback they confirmed.
 *
 * Returns the final model string to use (may differ from requested).
 */
export async function resolveWithFallback(
  requestedModel: string,
  agentName: string,
  ctx: ExtensionCommandContext,
  projectRoot: string,
  threadId: string
): Promise<string> {
  const status = await checkProvider(requestedModel);
  if (status.available) return requestedModel;

  const provider = providerFromModel(requestedModel);

  // Check if operator already decided for this provider in this thread
  const thread = await getThread(projectRoot, threadId);
  const cached = thread?.modelFallbacks?.[provider];
  if (cached) return cached;

  // Ask operator
  const fallback = FALLBACK_CHAIN[0] as string;
  const message =
    `⚠️  **Provider not configured:** \`${requestedModel}\` (${agentName})\n` +
    `${status.reason}\n\n` +
    `Proceed with \`${fallback}\` as fallback?\n` +
    `(Note: cross-family diversity is lost for this agent.)\n` +
    `y = use fallback, n = abort`;

  const answer = await ctx.ui.confirm("Provider not available", message);

  if (!answer) {
    throw new Error(
      `Provider not configured: ${requestedModel}. Aborted by operator.`
    );
  }

  // Cache decision in thread state so we don't ask again
  await updateThreadFallbacks(projectRoot, threadId, { [provider]: fallback as string });

  ctx.ui.notify(
    `Using ${fallback} for ${agentName} (${provider} unavailable)`,
    "info"
  );

  return fallback as string;
}
