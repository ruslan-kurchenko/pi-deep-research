import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderTemplate } from "../docs/render.js";

const TEMPLATES_DIR = new URL("../../templates/prompts/", import.meta.url).pathname;

/** Load and render a prompt template from templates/prompts/<name>.md */
export async function loadPrompt(
  name: string,
  vars: Record<string, string | string[]>
): Promise<string> {
  const file = join(TEMPLATES_DIR, `${name}.md`);
  const raw = await readFile(file, "utf8");
  return renderTemplate(raw, vars);
}

/** Build the grill-brief system prompt. */
export async function buildGrillPrompt(topic: string, memoryContext: string): Promise<string> {
  return loadPrompt("grill-brief", {
    topic,
    memory_context: memoryContext || "_No prior context found in MemPalace._",
  });
}

/** Format MemPalace search results into a compact context block for prompts. */
export function formatMemoryContext(
  results: Array<{ content: string; score?: number }>
): string {
  if (results.length === 0) return "";
  return results
    .slice(0, 5)
    .map((r, i) => `**[${i + 1}]** (score: ${(r.score ?? 0).toFixed(2)})\n${r.content.slice(0, 400)}`)
    .join("\n\n---\n\n");
}
