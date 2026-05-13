import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdir, rm, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { buildDoctorReport } from "../../src/commands/doctor.js";

// Helper: create a temporary project root
async function makeTmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pi-doctor-"));
}

describe("buildDoctorReport", () => {
  it("returns version:1, mode:quick, checks array, and configSummary", async () => {
    const tmp = await makeTmp();
    try {
      const report = await buildDoctorReport(tmp, "quick");
      expect(report.version).toBe(1);
      expect(report.mode).toBe("quick");
      expect(Array.isArray(report.checks)).toBe(true);
      expect(report.checks.length).toBeGreaterThan(0);
      expect(report.configSummary).toBeDefined();
      expect(typeof report.configSummary.user).toBe("string");
      expect(typeof report.configSummary.allowExternalScouts).toBe("boolean");
      expect(Array.isArray(report.configSummary.loadedScouts)).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("exitCode is 2 and config.parse is error when config.json has malformed JSON", async () => {
    const tmp = await makeTmp();
    try {
      await mkdir(join(tmp, ".pi", "deep-research"), { recursive: true });
      await writeFile(join(tmp, ".pi", "deep-research", "config.json"), "{ broken");
      const report = await buildDoctorReport(tmp, "quick");
      expect(report.exitCode).toBe(2);
      const check = report.checks.find((c) => c.id === "config.parse");
      expect(check).toBeDefined();
      expect(check!.status).toBe("error");
      expect(check!.remedy).toBeTruthy();
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("config.parse is ok when config file is valid JSON", async () => {
    const tmp = await makeTmp();
    try {
      await mkdir(join(tmp, ".pi", "deep-research"), { recursive: true });
      await writeFile(
        join(tmp, ".pi", "deep-research", "config.json"),
        JSON.stringify({ user: { name: "Test User" } })
      );
      const report = await buildDoctorReport(tmp, "quick");
      const check = report.checks.find((c) => c.id === "config.parse");
      expect(check!.status).toBe("ok");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("config.parse is ok when no config file exists (uses defaults)", async () => {
    const tmp = await makeTmp();
    try {
      const report = await buildDoctorReport(tmp, "quick");
      const check = report.checks.find((c) => c.id === "config.parse");
      expect(check!.status).toBe("ok");
      expect(check!.detail).toContain("defaults");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("quick checks include config.parse, dir.research.writable, dir.docs.writable", async () => {
    const tmp = await makeTmp();
    try {
      const report = await buildDoctorReport(tmp, "quick");
      const ids = report.checks.map((c) => c.id);
      expect(ids).toContain("config.parse");
      expect(ids).toContain("dir.research.writable");
      expect(ids).toContain("dir.docs.writable");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("dir.research.writable is ok (creates directory if missing)", async () => {
    const tmp = await makeTmp();
    try {
      const report = await buildDoctorReport(tmp, "quick");
      const check = report.checks.find((c) => c.id === "dir.research.writable");
      expect(check!.status).toBe("ok");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("deep mode has more checks than quick mode", async () => {
    const tmp = await makeTmp();
    try {
      const quick = await buildDoctorReport(tmp, "quick");
      const deep = await buildDoctorReport(tmp, "deep");
      expect(deep.checks.length).toBeGreaterThan(quick.checks.length);
      expect(deep.mode).toBe("deep");
      // Deep mode must include at least the registry placeholder check
      const deepIds = deep.checks.map((c) => c.id);
      expect(deepIds).toContain("scout.registry");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("exitCode is 0 when all credentials are set and config is clean", async () => {
    const tmp = await makeTmp();
    const saved = {
      ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"],
      OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
      GEMINI_API_KEY: process.env["GEMINI_API_KEY"],
    };
    try {
      process.env["ANTHROPIC_API_KEY"] = "test-key";
      process.env["OPENAI_API_KEY"] = "test-key";
      process.env["GEMINI_API_KEY"] = "test-key";
      const report = await buildDoctorReport(tmp, "quick");
      expect(report.exitCode).toBe(0);
    } finally {
      // Restore originals
      for (const [key, val] of Object.entries(saved)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("exitCode is 1 (warn) in deep mode when all credentials set but optional checks warn", async () => {
    const tmp = await makeTmp();
    const saved = {
      ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"],
      OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
      GEMINI_API_KEY: process.env["GEMINI_API_KEY"],
      EXA_API_KEY: process.env["EXA_API_KEY"],
    };
    try {
      process.env["ANTHROPIC_API_KEY"] = "test-key";
      process.env["OPENAI_API_KEY"] = "test-key";
      process.env["GEMINI_API_KEY"] = "test-key";
      delete process.env["EXA_API_KEY"];
      const report = await buildDoctorReport(tmp, "deep");
      // EXA_API_KEY missing = warn; scout.registry placeholder = warn → exitCode 1
      expect(report.exitCode).toBe(1);
    } finally {
      for (const [key, val] of Object.entries(saved)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("credential checks cover anthropic, openai, and google providers", async () => {
    const tmp = await makeTmp();
    const saved = {
      ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"],
      OPENAI_API_KEY: process.env["OPENAI_API_KEY"],
      GEMINI_API_KEY: process.env["GEMINI_API_KEY"],
    };
    try {
      delete process.env["ANTHROPIC_API_KEY"];
      delete process.env["OPENAI_API_KEY"];
      delete process.env["GEMINI_API_KEY"];
      const report = await buildDoctorReport(tmp, "quick");
      const ids = report.checks.map((c) => c.id);
      expect(ids).toContain("credential.anthropic");
      expect(ids).toContain("credential.openai");
      expect(ids).toContain("credential.google");
    } finally {
      for (const [key, val] of Object.entries(saved)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("configSummary.mempalaceUrl is null when not configured", async () => {
    const tmp = await makeTmp();
    try {
      const report = await buildDoctorReport(tmp, "quick");
      expect(report.configSummary.mempalaceUrl).toBeNull();
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("configSummary.mempalaceUrl is set when config has it", async () => {
    const tmp = await makeTmp();
    try {
      await mkdir(join(tmp, ".pi", "deep-research"), { recursive: true });
      await writeFile(
        join(tmp, ".pi", "deep-research", "config.json"),
        JSON.stringify({ mempalaceUrl: "https://mp.example.com" })
      );
      const report = await buildDoctorReport(tmp, "quick");
      expect(report.configSummary.mempalaceUrl).toBe("https://mp.example.com");
      expect(report.configSummary.loadedScouts).toContain("memory-mempalace");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("configSummary.allowExternalScouts is false by default", async () => {
    const tmp = await makeTmp();
    try {
      const report = await buildDoctorReport(tmp, "quick");
      expect(report.configSummary.allowExternalScouts).toBe(false);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("all DoctorCheck entries have required fields: id, mode, status, detail", async () => {
    const tmp = await makeTmp();
    try {
      const report = await buildDoctorReport(tmp, "deep");
      for (const check of report.checks) {
        expect(typeof check.id).toBe("string");
        expect(["quick", "deep"]).toContain(check.mode);
        expect(["ok", "warn", "error"]).toContain(check.status);
        expect(typeof check.detail).toBe("string");
        // remedy must be null or a string — never undefined
        expect(check.remedy === null || typeof check.remedy === "string").toBe(true);
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
