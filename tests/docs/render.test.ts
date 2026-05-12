import { describe, expect, it } from "vitest";
import { renderTemplate, validateTemplate } from "../../src/docs/render.js";

describe("renderTemplate", () => {
  it("replaces single placeholder", () => {
    expect(renderTemplate("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  it("replaces multiple distinct placeholders", () => {
    const tmpl = "{{greeting}} {{name}}, your score is {{score}}.";
    expect(renderTemplate(tmpl, { greeting: "Hi", name: "Ruslan", score: "42" })).toBe(
      "Hi Ruslan, your score is 42."
    );
  });

  it("replaces the same placeholder multiple times", () => {
    expect(renderTemplate("{{x}} + {{x}} = ?", { x: "1" })).toBe("1 + 1 = ?");
  });

  it("leaves unknown placeholders untouched by default", () => {
    expect(renderTemplate("Hello {{unknown}}!", {})).toBe("Hello {{unknown}}!");
  });

  it("throws when strict:true and placeholder is missing", () => {
    expect(() => renderTemplate("Hello {{missing}}!", {}, { strict: true })).toThrow(
      /missing placeholder: missing/i
    );
  });

  it("handles empty template", () => {
    expect(renderTemplate("", { foo: "bar" })).toBe("");
  });

  it("handles template with no placeholders", () => {
    expect(renderTemplate("no placeholders here", { foo: "bar" })).toBe("no placeholders here");
  });

  it("renders array values joined with newlines", () => {
    const result = renderTemplate("Items:\n{{items}}", { items: ["one", "two", "three"] });
    expect(result).toBe("Items:\none\ntwo\nthree");
  });

  it("renders number values as strings", () => {
    expect(renderTemplate("Score: {{score}}", { score: 99 })).toBe("Score: 99");
  });
});

describe("validateTemplate", () => {
  it("returns empty array for a fully satisfied template", () => {
    const missing = validateTemplate("{{a}} {{b}}", { a: "1", b: "2" });
    expect(missing).toEqual([]);
  });

  it("returns names of missing placeholders", () => {
    const missing = validateTemplate("{{a}} {{b}} {{c}}", { a: "1" });
    expect(missing.sort()).toEqual(["b", "c"]);
  });

  it("deduplicates repeated missing placeholders", () => {
    const missing = validateTemplate("{{x}} and {{x}}", {});
    expect(missing).toEqual(["x"]);
  });
});
