import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { buildGrillPrompt, formatMemoryContext } from "../lib/grill.js";
import { nextIndex, slugify, threadDir, threadId } from "../lib/paths.js";
import { buildMemPalaceClient } from "../mempalace/client.js";
import { createThread } from "../state/store.js";
import { setActiveThread } from "../state/store.js";

const SCOPE_OPTIONS = [
  "architecture",
  "feature",
  "module",
  "nfr",
  "combined",
] as const;

export async function runNew(
  args: string,
  ctx: ExtensionCommandContext,
  projectRoot: string
): Promise<void> {
  const topic = args.trim();
  if (!topic) {
    ctx.ui.notify("Usage: /research:new <topic>", "error");
    return;
  }

  // 1. Ask for scope (single-select — the pi API provides select, not multiSelect)
  const scope = await ctx.ui.select(
    "Research scope (primary):",
    [...SCOPE_OPTIONS]
  );
  if (!scope) return;

  // 2. Load MemPalace context (best-effort — never block on failure)
  let memoryContext = "";
  try {
    // pi-mcp-adapter exposes an `mcp` tool. We can't call tools directly from
    // extension commands, so we surface what we can from the environment and
    // leave the memory scout to do the real work during /research:scout.
    // The grill prompt still shows the placeholder so operators know it's coming.
    memoryContext = "_Memory scout will run during /research:scout._";
  } catch {
    memoryContext = "_MemPalace unavailable._";
  }

  // 3. Build grill prompt and show it as a notification (the LLM will conduct
  //    the interview after we return — the prompt is surfaced via the session).
  const grillPrompt = await buildGrillPrompt(topic, memoryContext);

  // 4. Create the thread folder + state
  const index = await nextIndex(projectRoot);
  const slug = slugify(topic);
  const id = threadId(index, slug);
  const dir = threadDir(projectRoot, id);

  await createThread(projectRoot, id, topic, [scope]);
  await setActiveThread(projectRoot, id);

  // 5. Write the initial brief.md with the grill prompt as starter content
  const briefPath = join(dir, "brief.md");
  const briefContent = [
    `# Research Brief: ${topic}`,
    "",
    `**Thread:** \`${id}\``,
    `**Scope:** ${scope}`,
    `**Created:** ${new Date().toISOString()}`,
    "",
    "---",
    "",
    "## Grill questions (to be filled in during /research:groom)",
    "",
    grillPrompt,
    "",
    "---",
    "",
    "## Answers (fill in during interview)",
    "",
    "<!-- The /research:groom command will walk through these interactively -->",
  ].join("\n");

  await writeFile(briefPath, briefContent);

  // 6. Ensure research/ is gitignored in project root
  await ensureGitignore(projectRoot);

  ctx.ui.notify(`Research thread created: ${id}`, "info");
  ctx.ui.notify(
    `Brief at: research/${id}/brief.md\nRun /research:scout to dispatch parallel scouts.`,
    "info"
  );
}

async function ensureGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = join(projectRoot, ".gitignore");
  const entry = "research/";
  try {
    const { readFile, appendFile } = await import("node:fs/promises");
    let existing = "";
    try {
      existing = await readFile(gitignorePath, "utf8");
    } catch {
      // no .gitignore yet — create it
    }
    if (!existing.includes(entry)) {
      await appendFile(gitignorePath, `\n# pi-deep-research working notes\n${entry}\n`);
    }
  } catch {
    // best-effort — never fail the command
  }
}

// Re-export for use in index.ts
export { buildMemPalaceClient };
