import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const PKG_AGENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "agents");
const USER_AGENTS_DIR = join(homedir(), ".pi", "agent", "agents");

function md5(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

/**
 * Copy bundled agent profiles to ~/.pi/agent/agents/ on extension load.
 * Idempotent — only writes a file if it's missing or its content has changed.
 * Returns a summary of what changed.
 */
export async function ensureAgentsInstalled(): Promise<{
  installed: string[];
  updated: string[];
  skipped: string[];
}> {
  const result = { installed: [] as string[], updated: [] as string[], skipped: [] as string[] };

  await mkdir(USER_AGENTS_DIR, { recursive: true });

  let entries: string[];
  try {
    entries = await readdir(PKG_AGENTS_DIR);
  } catch {
    // Agents dir missing in package — nothing to do
    return result;
  }

  const mdFiles = entries.filter((e) => e.endsWith(".md"));

  await Promise.all(
    mdFiles.map(async (file) => {
      const src = join(PKG_AGENTS_DIR, file);
      const dst = join(USER_AGENTS_DIR, file);

      const srcContent = await readFile(src, "utf8");

      let dstContent: string | null = null;
      try {
        dstContent = await readFile(dst, "utf8");
      } catch {
        // File doesn't exist yet
      }

      if (dstContent === null) {
        await copyFile(src, dst);
        result.installed.push(file);
      } else if (md5(srcContent) !== md5(dstContent)) {
        await copyFile(src, dst);
        result.updated.push(file);
      } else {
        result.skipped.push(file);
      }
    })
  );

  return result;
}
