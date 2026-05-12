import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";

/** Read a single file, returning null on ENOENT instead of throwing. */
export async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/** Read all *.md files inside a directory, returning a map of filename → content. */
export async function readMarkdownDir(
  dir: string
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  const sorted = entries.filter((e) => e.endsWith(".md")).sort();
  const contents = await Promise.all(
    sorted.map((e) => readOptional(join(dir, e)))
  );
  for (let i = 0; i < sorted.length; i++) {
    const content = contents[i];
    if (content !== null && content !== undefined) out.set(sorted[i] as string, content);
  }
  return out;
}

/**
 * Concatenate multiple file contents into one block for use in LLM prompts.
 * Each file is wrapped with a header showing its name.
 */
export function aggregateFiles(files: Map<string, string>): string {
  if (files.size === 0) return "_No files found._";
  return [...files.entries()]
    .map(
      ([name, content]) =>
        `### ${basename(name)}\n\n${content.trim()}`
    )
    .join("\n\n---\n\n");
}

/** Read and aggregate all raw scout outputs from a thread's raw/ directory. */
export async function readRawScouts(threadDir: string): Promise<string> {
  const files = await readMarkdownDir(join(threadDir, "raw"));
  return aggregateFiles(files);
}
