import { describe, expect, it } from "vitest";
import { buildFrontmatter, prependFrontmatter } from "../../src/lib/frontmatter.js";

describe("buildFrontmatter", () => {
  it("produces a valid YAML block", () => {
    const fm = buildFrontmatter({ agent: "research-web-scout", model: "claude-haiku-4-5" });
    expect(fm).toMatch(/^---\n/);
    expect(fm).toMatch(/\n---$/);
    expect(fm).toContain("agent: research-web-scout");
    expect(fm).toContain("model: claude-haiku-4-5");
  });

  it("quotes values that contain colons", () => {
    const fm = buildFrontmatter({ title: "foo: bar" });
    expect(fm).toContain('"foo: bar"');
  });

  it("leaves plain alphanumeric unquoted", () => {
    const fm = buildFrontmatter({ status: "draft" });
    expect(fm).toContain("status: draft");
    expect(fm).not.toContain('"draft"');
  });
});

describe("prependFrontmatter", () => {
  it("prepends to content without existing frontmatter", () => {
    const result = prependFrontmatter("# My doc\ncontent", { model: "haiku" });
    expect(result).toMatch(/^---\n/);
    expect(result).toContain("# My doc");
  });

  it("replaces existing frontmatter", () => {
    const existing = "---\nmodel: old-model\n---\n\n# Content";
    const result = prependFrontmatter(existing, { model: "new-model" });
    expect(result).not.toContain("old-model");
    expect(result).toContain("new-model");
    expect(result).toContain("# Content");
  });
});
