import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { listThreads } from "../state/store.js";

export async function runStatus(
  _args: string,
  ctx: ExtensionCommandContext,
  projectRoot: string,
  activeThreadId: string | null
): Promise<void> {
  const threads = await listThreads(projectRoot);

  if (threads.length === 0) {
    ctx.ui.notify("No research threads. Start with /research:new <topic>.", "info");
    return;
  }

  const lines = [
    "# Research threads",
    "",
    ...threads.map((t) => {
      const active = t.id === activeThreadId ? " ← active" : "";
      const docs = Object.entries(t.linkedDocs)
        .filter(([, v]) => v !== undefined)
        .map(([k]) => k)
        .join(", ");
      return [
        `**${t.id}**${active}`,
        `  Phase: \`${t.phase}\`  |  Scope: ${t.scope.join(", ")}`,
        `  Topic: ${t.topic}`,
        docs ? `  Docs: ${docs}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  ];

  ctx.ui.notify(lines.join("\n"), "info");
}

export async function runResume(
  args: string,
  ctx: ExtensionCommandContext,
  projectRoot: string,
  globalStateDir: string
): Promise<void> {
  const id = args.trim();
  const { getThread, setActiveThread } = await import("../state/store.js");

  if (!id) {
    // show list and let operator pick
    const threads = await listThreads(projectRoot);
    if (threads.length === 0) {
      ctx.ui.notify("No threads to resume.", "info");
      return;
    }
    const choice = await ctx.ui.select(
      "Select thread to resume:",
      threads.map((t) => `${t.id} [${t.phase}] — ${t.topic}`)
    );
    if (!choice) return;
    const chosenId = choice.split(" ")[0];
    if (!chosenId) return;
    await setActiveThread(globalStateDir, chosenId);
    ctx.ui.notify(`Resumed: ${chosenId}`, "info");
    return;
  }

  const thread = await getThread(projectRoot, id);
  if (!thread) {
    ctx.ui.notify(`Thread not found: ${id}`, "error");
    return;
  }
  await setActiveThread(globalStateDir, id);
  ctx.ui.notify(`Resumed: ${id} (phase: ${thread.phase})`, "info");
}
