import { access, constants, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "../config/config.js";
import { AGENT_MODEL_DEFAULTS } from "../config/models.js";
import { providerFromModel } from "../config/providers.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DoctorCheck {
  id: string;
  mode: "quick" | "deep";
  status: "ok" | "warn" | "error";
  detail: string;
  remedy: string | null;
}

export interface DoctorReport {
  version: 1;
  exitCode: 0 | 1 | 2;
  mode: "quick" | "deep";
  checks: DoctorCheck[];
  configSummary: {
    user: string;
    mempalaceUrl: string | null;
    allowExternalScouts: boolean;
    loadedScouts: string[];
    activeModels: Record<string, string>;
  };
}

// ── Provider credential map ───────────────────────────────────────────────────

const PROVIDER_ENV_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
};

const KNOWN_PROVIDERS = new Set(Object.keys(PROVIDER_ENV_KEYS));

// ── Core report builder ───────────────────────────────────────────────────────

export async function buildDoctorReport(
  projectRoot: string,
  mode: "quick" | "deep"
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const config = await loadConfig(projectRoot);

  // ── 1. config.parse ─────────────────────────────────────────────────────────
  const configPath = join(projectRoot, ".pi", "deep-research", "config.json");
  let configStatus: "ok" | "error" = "ok";
  let configDetail = "Using defaults (no config file found)";
  try {
    const raw = await readFile(configPath, "utf8");
    JSON.parse(raw); // throws on malformed
    configDetail = "Loaded from .pi/deep-research/config.json";
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      configStatus = "error";
      configDetail = `Parse error in .pi/deep-research/config.json: ${String(e)}`;
    }
  }
  checks.push({
    id: "config.parse",
    mode: "quick",
    status: configStatus,
    detail: configDetail,
    remedy:
      configStatus === "error"
        ? "Fix JSON syntax in .pi/deep-research/config.json"
        : null,
  });

  // ── 2. credential.<provider> ────────────────────────────────────────────────
  // Collect every model referenced in defaults + config overrides, derive
  // distinct providers, emit one check per provider.
  const allModels: string[] = [
    ...Object.values(AGENT_MODEL_DEFAULTS),
    ...Object.values(config.models ?? {}),
  ];
  const seenProviderChecks = new Set<string>();

  for (const model of allModels) {
    const provider = providerFromModel(model);

    if (!KNOWN_PROVIDERS.has(provider)) {
      // Unknown provider — emit warn (once per model)
      const checkId = `credential.unknown.${model}`;
      if (seenProviderChecks.has(checkId)) continue;
      seenProviderChecks.add(checkId);
      checks.push({
        id: checkId,
        mode: "quick",
        status: "warn",
        detail: `Model '${model}' maps to unknown provider; credential check skipped`,
        remedy: "Set credentials via your provider's documented env var",
      });
      continue;
    }

    if (seenProviderChecks.has(provider)) continue;
    seenProviderChecks.add(provider);

    const envKey = PROVIDER_ENV_KEYS[provider]!;
    const isSet = Boolean(process.env[envKey]);
    checks.push({
      id: `credential.${provider}`,
      mode: "quick",
      status: isSet ? "ok" : "error",
      detail: isSet ? `${envKey} is set` : `${envKey} not set`,
      remedy: isSet ? null : `Set the ${envKey} environment variable`,
    });
  }

  // ── 3. dir.research.writable ────────────────────────────────────────────────
  const researchDir = join(projectRoot, "research");
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(researchDir, { recursive: true });
    await access(researchDir, constants.W_OK);
    checks.push({
      id: "dir.research.writable",
      mode: "quick",
      status: "ok",
      detail: "research/ is writable",
      remedy: null,
    });
  } catch {
    checks.push({
      id: "dir.research.writable",
      mode: "quick",
      status: "error",
      detail: "research/ is not writable or could not be created",
      remedy: "Check directory permissions",
    });
  }

  // ── 4. dir.docs.writable ────────────────────────────────────────────────────
  const docsDir = join(projectRoot, "docs");
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(docsDir, { recursive: true });
    await access(docsDir, constants.W_OK);
    checks.push({
      id: "dir.docs.writable",
      mode: "quick",
      status: "ok",
      detail: "docs/ is writable",
      remedy: null,
    });
  } catch {
    checks.push({
      id: "dir.docs.writable",
      mode: "quick",
      status: "error",
      detail: "docs/ is not writable or could not be created",
      remedy: "Check directory permissions",
    });
  }

  // ── Deep checks ─────────────────────────────────────────────────────────────
  if (mode === "deep") {
    // Web scout env
    const exaKey = process.env["EXA_API_KEY"];
    checks.push({
      id: "scout.web.env.EXA_API_KEY",
      mode: "deep",
      status: exaKey ? "ok" : "warn",
      detail: exaKey
        ? "EXA_API_KEY is set"
        : "EXA_API_KEY not set (web scout will use Context7 only)",
      remedy: exaKey
        ? null
        : "Set EXA_API_KEY for full web search; web scout degrades gracefully without it",
    });

    // Placeholder: full registry integration is wired in Layer 3 completion
    checks.push({
      id: "scout.registry",
      mode: "deep",
      status: "warn",
      detail: "Scout registry not yet wired (ScoutDefinition plugin surface in progress)",
      remedy:
        "Run /research:doctor --deep after Layer 3 (ScoutDefinition + registry) is complete",
    });
  }

  // ── Compute exit code ────────────────────────────────────────────────────────
  const hasError = checks.some((c) => c.status === "error");
  const hasWarn = checks.some((c) => c.status === "warn");
  const exitCode: 0 | 1 | 2 = hasError ? 2 : hasWarn ? 1 : 0;

  // ── Config summary ───────────────────────────────────────────────────────────
  const loadedScouts = ["web", "oss", "repo"];
  if (config.mempalaceUrl) loadedScouts.push("memory-mempalace");

  return {
    version: 1,
    exitCode,
    mode,
    checks,
    configSummary: {
      user: config.user?.name ?? "Unknown",
      mempalaceUrl: config.mempalaceUrl ?? null,
      allowExternalScouts: config.allowExternalScouts ?? false,
      loadedScouts,
      activeModels: { ...AGENT_MODEL_DEFAULTS, ...(config.models ?? {}) },
    },
  };
}

// ── Command handler ───────────────────────────────────────────────────────────

export async function runDoctor(
  args: string,
  ctx: ExtensionCommandContext,
  projectRoot: string
): Promise<void> {
  const isDeep = args.includes("--deep");
  const isJson = args.includes("--json");
  const mode = isDeep ? "deep" : "quick";

  const report = await buildDoctorReport(projectRoot, mode);

  if (isJson) {
    ctx.ui.notify(JSON.stringify(report, null, 2), "info");
    if (report.exitCode > 0) {
      ctx.ui.notify(
        `Doctor exit code: ${report.exitCode} (${
          report.exitCode === 1 ? "warnings" : "errors"
        })`,
        report.exitCode === 2 ? "error" : "warn"
      );
    }
    return;
  }

  // Human-readable output
  const lines: string[] = [`## /research:doctor (${mode} mode)`, ""];

  for (const check of report.checks) {
    const icon =
      check.status === "ok" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
    lines.push(`${icon} **${check.id}**: ${check.detail}`);
    if (check.remedy && check.status !== "ok") {
      lines.push(`   ↳ ${check.remedy}`);
    }
  }

  lines.push(
    "",
    `**Scout roster:** ${
      report.configSummary.loadedScouts.join(", ") || "(none loaded)"
    }`
  );
  lines.push(`**User:** ${report.configSummary.user}`);
  lines.push(
    `**MemPalace:** ${report.configSummary.mempalaceUrl ?? "(not configured)"}`
  );
  lines.push(
    `**External scouts:** ${
      report.configSummary.allowExternalScouts ? "enabled" : "disabled (default)"
    }`
  );

  const summary =
    report.exitCode === 0
      ? "✅ All checks passed"
      : report.exitCode === 1
      ? "⚠️ Some checks warned"
      : "❌ Some checks failed";
  lines.push("", "---", summary);

  ctx.ui.notify(
    lines.join("\n"),
    report.exitCode === 2 ? "error" : "info"
  );
}
