import { describe, expect, it, vi, afterEach } from "vitest";
import { checkProvider, providerFromModel } from "../../src/config/providers.js";

describe("providerFromModel", () => {
  it("infers anthropic from native claude- prefix", () => {
    expect(providerFromModel("claude-haiku-4-5")).toBe("anthropic");
    expect(providerFromModel("claude-sonnet-4-6")).toBe("anthropic");
  });

  it("infers openai from native gpt- prefix", () => {
    expect(providerFromModel("gpt-5.5")).toBe("openai");
    expect(providerFromModel("gpt-4o")).toBe("openai");
  });

  it("infers openai from o-series prefix", () => {
    expect(providerFromModel("o3")).toBe("openai");
    expect(providerFromModel("o4-mini")).toBe("openai");
  });

  it("infers google from native gemini- prefix", () => {
    expect(providerFromModel("gemini-2.5-pro")).toBe("google");
  });

  it("still supports legacy slash format", () => {
    expect(providerFromModel("anthropic/claude-haiku-4.5")).toBe("anthropic");
    expect(providerFromModel("openai/gpt-5.5")).toBe("openai");
    expect(providerFromModel("google/gemini-2.5-pro")).toBe("google");
  });

  it("returns full string for unknown native model", () => {
    expect(providerFromModel("some-unknown-model")).toBe("some-unknown-model");
  });
});

describe("checkProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("anthropic native ID → available when ANTHROPIC_API_KEY set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const result = await checkProvider("claude-haiku-4-5");
    expect(result.available).toBe(true);
    expect(result.provider).toBe("anthropic");
  });

  it("anthropic native ID → unavailable when ANTHROPIC_API_KEY missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await checkProvider("claude-sonnet-4-6");
    expect(result.available).toBe(false);
    expect(result.reason).toContain("ANTHROPIC_API_KEY");
  });

  it("openai native ID → available when OPENAI_API_KEY set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
    const result = await checkProvider("gpt-5.5");
    expect(result.available).toBe(true);
    expect(result.provider).toBe("openai");
  });

  it("openai native ID → unavailable when OPENAI_API_KEY missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await checkProvider("gpt-5.5");
    expect(result.available).toBe(false);
    expect(result.reason).toContain("OPENAI_API_KEY");
  });

  it("unknown model → available by default", async () => {
    const result = await checkProvider("custom/my-local-model");
    expect(result.available).toBe(true);
    expect(result.provider).toBe("custom");
  });
});
