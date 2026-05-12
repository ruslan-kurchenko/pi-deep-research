import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AGENT_MODEL_DEFAULTS,
  FALLBACK_CHAIN,
  loadModelsConfig,
  resolveAgentModel,
  resolveAgentModels,
} from "../../src/config/models.js";

const TMP = join(import.meta.dirname, "../../.tmp-config-models-test");

beforeEach(() => mkdir(TMP, { recursive: true }));
afterEach(() => rm(TMP, { recursive: true, force: true }));

describe("AGENT_MODEL_DEFAULTS", () => {
  it("covers all 10 known agents", () => {
    const expected = [
      "research-memory-scout", "research-web-scout",
      "research-repo-scout", "research-oss-scout",
      "research-synthesizer", "research-challenger",
      "research-devils-advocate", "research-doc-advisor",
      "research-kpi-architect", "research-architect",
    ];
    for (const agent of expected) {
      expect(AGENT_MODEL_DEFAULTS[agent], `missing: ${agent}`).toBeDefined();
    }
  });

  it("haiku agents use haiku model", () => {
    for (const agent of ["research-web-scout", "research-memory-scout", "research-doc-advisor"]) {
      expect(AGENT_MODEL_DEFAULTS[agent]).toContain("haiku");
    }
  });

  it("cross-check agents use Gemini", () => {
    expect(AGENT_MODEL_DEFAULTS["research-challenger"]).toContain("gemini");
    expect(AGENT_MODEL_DEFAULTS["research-devils-advocate"]).toContain("gemini");
  });
});

describe("loadModelsConfig", () => {
  it("returns empty agents when no config file exists", async () => {
    const cfg = await loadModelsConfig(TMP);
    expect(cfg.agents).toEqual({});
  });

  it("parses a real config file", async () => {
    const piDir = join(TMP, ".pi", "deep-research");
    await mkdir(piDir, { recursive: true });
    await writeFile(
      join(piDir, "models.json"),
      JSON.stringify({ agents: { "research-oracle": "openai/gpt-5.5" } })
    );
    const cfg = await loadModelsConfig(TMP);
    expect(cfg.agents["research-oracle"]).toBe("openai/gpt-5.5");
  });
});

describe("resolveAgentModel", () => {
  it("returns default when no override", async () => {
    const model = await resolveAgentModel("research-web-scout", TMP);
    expect(model).toBe("anthropic/claude-haiku-4.5");
  });

  it("project file overrides default", async () => {
    const piDir = join(TMP, ".pi", "deep-research");
    await mkdir(piDir, { recursive: true });
    await writeFile(
      join(piDir, "models.json"),
      JSON.stringify({ agents: { "research-web-scout": "openai/gpt-5.5" } })
    );
    const model = await resolveAgentModel("research-web-scout", TMP);
    expect(model).toBe("openai/gpt-5.5");
  });

  it("falls back to FALLBACK_CHAIN for unknown agent", async () => {
    const model = await resolveAgentModel("research-unknown-agent", TMP);
    expect(model).toBe(FALLBACK_CHAIN[0]);
  });
});

describe("resolveAgentModels (batch)", () => {
  it("resolves multiple agents at once", async () => {
    const models = await resolveAgentModels(
      ["research-web-scout", "research-synthesizer"],
      TMP
    );
    expect(models["research-web-scout"]).toContain("haiku");
    expect(models["research-synthesizer"]).toContain("sonnet");
  });
});
