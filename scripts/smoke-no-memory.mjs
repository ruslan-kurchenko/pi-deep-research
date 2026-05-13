#!/usr/bin/env bun
/**
 * Smoke test: no MemPalace calls when mempalaceUrl is absent.
 * Metric M2 verification.
 *
 * Usage: node scripts/smoke-no-memory.mjs
 * Exit 0 = all checks passed, Exit 1 = one or more checks failed.
 */

import { buildEvaluateInstruction } from "../src/docs/instructions.js";

const PASS = "\x1b[32m✅ PASS\x1b[0m";
const FAIL = "\x1b[31m❌ FAIL\x1b[0m";

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`${PASS} ${name}`);
  } else {
    console.log(`${FAIL} ${name}${detail ? ": " + detail : ""}`);
    failures++;
  }
}

// Ensure no MemPalace env vars leak in
delete process.env.MEMPALACE_URL;

// Shared args (threadId, contractPath, contractContent, outputPath, today, adapterName, projectRoot)
const BASE_ARGS = [
  "001-test",
  "/path/to/contract.md",
  "## Contract\n\n**Metric 1:** test",
  "/path/to/output.md",
  "2026-05-13",
  "manual",
  "/tmp/project",
];

// Check 1: no mempalaceUrl arg (undefined) → no mempalace_ calls
const result1 = buildEvaluateInstruction(...BASE_ARGS, undefined);
check(
  "buildEvaluateInstruction(undefined mempalaceUrl) emits no mempalace_ calls",
  !result1.includes("mempalace_"),
  result1.includes("mempalace_") ? "FOUND mempalace_ in output (Bug I regression)" : ""
);

// Check 2: 7-arg form (no 8th arg) → backward compat → no mempalace_ calls
const result2 = buildEvaluateInstruction(...BASE_ARGS);
check(
  "buildEvaluateInstruction(7-arg form, no mempalaceUrl) emits no mempalace_ calls",
  !result2.includes("mempalace_"),
  result2.includes("mempalace_") ? "FOUND mempalace_ in output (7-arg form)" : ""
);

// Check 3: with mempalaceUrl → includes mempalace_add_drawer (positive control)
const result3 = buildEvaluateInstruction(...BASE_ARGS, "https://mp.example.com");
check(
  "buildEvaluateInstruction(with mempalaceUrl) includes mempalace_add_drawer",
  result3.includes("mempalace_add_drawer"),
  !result3.includes("mempalace_add_drawer") ? "mempalace_add_drawer missing even with mempalaceUrl set" : ""
);

// Check 4: with mempalaceUrl → wing derived from projectRoot
check(
  "buildEvaluateInstruction(with mempalaceUrl) includes wing derived from projectRoot",
  result3.includes("project-"),
  "expected 'project-<name>' wing to appear in instruction"
);

if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed — Bug I or E regression.`);
  process.exit(1);
} else {
  console.log(`\nAll ${4 - failures} smoke checks passed (Metric M2 ✅).`);
  process.exit(0);
}
