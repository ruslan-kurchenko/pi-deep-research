import { readdir } from "node:fs/promises";
import { join } from "node:path";

/** Convert a topic string to a URL-safe kebab-case slug (max 60 chars). */
export function slugify(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/@[a-z0-9/_-]+/g, (m) => m.replace(/@/g, "").replace(/\//g, "-"))  // @services/kai → services-kai
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Absolute path to <projectRoot>/research */
export function researchDir(projectRoot: string): string {
  return join(projectRoot, "research");
}

/**
 * Find the highest existing NNN prefix across research/NNN-* dirs,
 * return that + 1. Returns 1 if directory is empty or missing.
 */
export async function nextIndex(projectRoot: string): Promise<number> {
  const dir = researchDir(projectRoot);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 1;
  }

  const indices = entries
    .map((e) => /^(\d{3,})-/.exec(e))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number.parseInt(m[1]!, 10));

  return indices.length === 0 ? 1 : Math.max(...indices) + 1;
}

/** Compose a thread id like "001-my-topic" */
export function threadId(index: number, slug: string): string {
  return `${String(index).padStart(3, "0")}-${slug}`;
}

/** Absolute path to the thread directory */
export function threadDir(projectRoot: string, id: string): string {
  return join(researchDir(projectRoot), id);
}
