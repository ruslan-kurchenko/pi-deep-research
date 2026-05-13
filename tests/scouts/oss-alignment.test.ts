import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

describe("[bug-C] OSS scout tool consistency", () => {
  it("agent profile includes librarian in tools", () => {
    const md = readFileSync(join(ROOT, "agents/research-oss-scout.md"), "utf8");
    const toolsLine = md.match(/^tools:\s*(.+)$/m)?.[1] ?? "";
    const tools = toolsLine.split(/,\s*/);
    expect(tools).toContain("librarian");
    expect(tools).toContain("bash");
  });

  it("prompt template references librarian tool", () => {
    const md = readFileSync(join(ROOT, "templates/prompts/scout-oss.md"), "utf8");
    expect(md).toContain("librarian");
  });

  it("agent systemPrompt mentions both librarian and bash/gh", () => {
    const md = readFileSync(join(ROOT, "agents/research-oss-scout.md"), "utf8");
    // Strip frontmatter
    const body = md.replace(/^---[\s\S]*?---\n/, "");
    expect(body.toLowerCase()).toMatch(/librarian/);
    expect(body.toLowerCase()).toMatch(/bash|gh/);
  });

  it("prompt template mentions both librarian and gh CLI approaches", () => {
    const md = readFileSync(join(ROOT, "templates/prompts/scout-oss.md"), "utf8");
    expect(md).toContain("librarian");
    expect(md.toLowerCase()).toMatch(/`gh`|gh cli/);
  });
});
