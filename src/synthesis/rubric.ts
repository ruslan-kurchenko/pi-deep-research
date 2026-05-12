import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RUBRIC_FILE = "rubric.md";

export async function loadRubric(threadDir: string): Promise<string | null> {
  try {
    return await readFile(join(threadDir, RUBRIC_FILE), "utf8");
  } catch {
    return null;
  }
}

export async function saveRubric(threadDir: string, content: string): Promise<void> {
  await writeFile(join(threadDir, RUBRIC_FILE), content, "utf8");
}
