import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type DocType = "adr" | "rfc" | "design-doc" | "prd" | "measurement" | "evaluation";

const DOC_DIRS: Record<DocType, string> = {
  adr: "docs/decisions/adrs",
  rfc: "docs/rfcs",
  "design-doc": "docs/design-docs",
  prd: "docs/prds",
  measurement: "docs/measurement",
  evaluation: "docs/evaluation",
};

/** Return the relative directory for a given doc type. */
export function docDir(projectRoot: string, type: DocType): string {
  return join(projectRoot, DOC_DIRS[type]);
}

/**
 * Find the highest NNN prefix across ALL doc directories combined,
 * then return max + 1. Ensures IDs are globally unique across doc types.
 */
export async function nextDocNumber(projectRoot: string): Promise<number> {
  const allIndices: number[] = [];

  await Promise.all(
    Object.values(DOC_DIRS).map(async (rel) => {
      const dir = join(projectRoot, rel);
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const m = /^(\d{3,})-/.exec(entry);
        if (m?.[1]) allIndices.push(Number.parseInt(m[1], 10));
      }
    })
  );

  return allIndices.length === 0 ? 1 : Math.max(...allIndices) + 1;
}

/** Compose the full output path for a doc file. */
export function docOutputPath(
  projectRoot: string,
  type: DocType,
  num: number,
  slug: string
): string {
  const id = `${String(num).padStart(3, "0")}-${slug}`;
  return join(docDir(projectRoot, type), `${id}.md`);
}
