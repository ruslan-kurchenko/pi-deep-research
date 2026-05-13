import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTRUCTIONS_PATH = join(__dirname, "../../src/docs/instructions.ts");

describe("Author name — no hardcoded identity (Metric M1)", () => {
  it('src/docs/instructions.ts contains no literal "Ruslan Kurchenko" string', async () => {
    const src = await readFile(INSTRUCTIONS_PATH, "utf8");
    // The literal should not appear as a hardcoded value
    // resolveAuthorName() replaces every occurrence dynamically
    expect(src).not.toContain('"Ruslan Kurchenko"');
  });
});
