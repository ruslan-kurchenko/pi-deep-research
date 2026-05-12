import { describe, expect, it, vi, afterEach } from "vitest";
import { checkProvider, providerFromModel } from "../../src/config/providers.js";

describe("providerFromModel", () => {
  it("extracts prefix before slash", () => {
    expect(providerFromModel("anthropic/claude-haiku-4.5")).toBe("anthropic");
    expect(providerFromModel("openai/gpt-5.5")).toBe("openai");
    expect(providerFromModel("google/gemini-3.1-pro-preview")).toBe("google");
  });

  it("returns full string when no slash", () => {
    expect(providerFromModel("haiku")).toBe("haiku");
  });
});

describe("checkProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("anthropic → available when ANTHROPIC_API_KEY set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const result = await checkProvider("anthropic/claude-haiku-4.5");
    expect(result.available).toBe(true);
    expect(result.provider).toBe("anthropic");
  });

  it("anthropic → unavailable when ANTHROPIC_API_KEY missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await checkProvider("anthropic/claude-haiku-4.5");
    expect(result.available).toBe(false);
    expect(result.reason).toContain("ANTHROPIC_API_KEY");
  });

  it("openai → available when OPENAI_API_KEY set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
    const result = await checkProvider("openai/gpt-5.5");
    expect(result.available).toBe(true);
    expect(result.provider).toBe("openai");
  });

  it("openai → unavailable when OPENAI_API_KEY missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await checkProvider("openai/gpt-5.5");
    expect(result.available).toBe(false);
    expect(result.reason).toContain("OPENAI_API_KEY");
  });

  it("unknown provider → available by default", async () => {
    const result = await checkProvider("custom/my-local-model");
    expect(result.available).toBe(true);
    expect(result.provider).toBe("custom");
  });
});
