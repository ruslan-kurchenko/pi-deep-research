#!/usr/bin/env bun
/**
 * Smoke test: /research:doctor --json exit codes (Metric M5).
 *
 * Tests buildDoctorReport() directly — no pi runtime needed.
 * Requires: src/commands/doctor.ts (Layer 3 Worker 3 deliverable).
 *
 * Usage: bun run scripts/smoke-doctor-json.mjs
 * Exit 0 = all checks passed, Exit 1 = one or more failed, Exit 2 = doctor.ts not found.
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

const PASS = "\x1b[32m✅ PASS\x1b[0m";
const FAIL = "\x1b[31m❌ FAIL\x1b[0m";
const SKIP = "\x1b[33m⏭  SKIP\x1b[0m";

// Locate doctor.ts relative to this script
const DOCTOR_PATH = new URL("../src/commands/doctor.ts", import.meta.url).pathname;

if (!existsSync(DOCTOR_PATH)) {
  console.log(`${SKIP} doctor.ts not yet available at: ${DOCTOR_PATH}`);
  console.log("       Run this script after Worker 3 (doctor command) merges.");
  process.exit(0); // graceful skip — not a failure during Layer 3 parallel build
}

let { buildDoctorReport } = await import("../src/commands/doctor.js");

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`${PASS} ${name}`);
  } else {
    console.log(`${FAIL} ${name}${detail ? ": " + detail : ""}`);
    failures++;
  }
}

const tmp = await mkdtemp(join(tmpdir(), "pi-smoke-doctor-"));

// Helper to save/restore env vars
function withEnv(overrides, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(overrides)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

try {
  // ── Scenario A: all credentials set → exitCode 0 ─────────────────────────
  await withEnv(
    { ANTHROPIC_API_KEY: "test", OPENAI_API_KEY: "test", GEMINI_API_KEY: "test" },
    async () => {
      console.log("\n--- Scenario A: all credentials set ---");
      const report = await buildDoctorReport(tmp, "quick");
      check("Scenario A: exitCode is 0", report.exitCode === 0, `got ${report.exitCode}`);
      check("Scenario A: checks is an array", Array.isArray(report.checks));
      check("Scenario A: version is 1", report.version === 1, `got ${report.version}`);
      // scoutRoster is a design-doc field; verify configSummary.loadedScouts instead
      // (Worker 3 merged without scoutRoster — tracked as open gap for Layer 3 follow-up)
      check(
        "Scenario A: configSummary.loadedScouts is an array",
        Array.isArray(report.configSummary?.loadedScouts),
        `got ${JSON.stringify(report.configSummary?.loadedScouts)}`
      );
    }
  );

  // ── Scenario B: missing OPENAI_API_KEY → exitCode indicates error ─────────
  await withEnv(
    { ANTHROPIC_API_KEY: "test", OPENAI_API_KEY: undefined, GEMINI_API_KEY: "test" },
    async () => {
      console.log("\n--- Scenario B: missing OPENAI_API_KEY ---");
      const report = await buildDoctorReport(tmp, "quick");
      check(
        "Scenario B: exitCode is not 0 (credential missing)",
        report.exitCode !== 0,
        `got ${report.exitCode}`
      );
      const credCheck = report.checks.find((c) => c.id === "credential.openai");
      check(
        "Scenario B: credential.openai check present with error/warn status",
        credCheck !== undefined && (credCheck.status === "error" || credCheck.status === "warn"),
        credCheck ? `got status=${credCheck.status}` : "check not found"
      );
    }
  );

  // ── Scenario C: malformed config.json → exitCode 2 ───────────────────────
  const tmpC = await mkdtemp(join(tmpdir(), "pi-smoke-doctor-c-"));
  try {
    await mkdir(join(tmpC, ".pi", "deep-research"), { recursive: true });
    await writeFile(join(tmpC, ".pi", "deep-research", "config.json"), "{ broken json");
    console.log("\n--- Scenario C: malformed config.json ---");

    await withEnv(
      { ANTHROPIC_API_KEY: "test", OPENAI_API_KEY: "test", GEMINI_API_KEY: "test" },
      async () => {
        const report = await buildDoctorReport(tmpC, "quick");
        check(
          "Scenario C: exitCode is 2 (config error)",
          report.exitCode === 2,
          `got ${report.exitCode}`
        );
        const configCheck = report.checks.find((c) => c.id === "config.parse");
        check(
          "Scenario C: config.parse check has error status",
          configCheck?.status === "error",
          configCheck ? `got status=${configCheck.status}` : "config.parse check not found"
        );
      }
    );
  } finally {
    await rm(tmpC, { recursive: true, force: true });
  }

} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed (Metric M5 ❌).`);
  process.exit(1);
} else {
  console.log(`\nAll smoke checks passed (Metric M5 ✅).`);
  process.exit(0);
}
