import type { ResearchPhase, ResearchThread } from "./store.js";

export const PHASE_ORDER: ResearchPhase[] = [
  "brief",
  "scout",
  "groom",
  "alternatives",
  "docs",
  "contract",
  "evaluate",
  "closed",
];

function indexOf(phase: ResearchPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

/** Returns true if moving from `current` to `target` is a forward (or skip-forward) transition. */
export function canAdvanceTo(current: ResearchPhase, target: ResearchPhase): boolean {
  return indexOf(target) > indexOf(current);
}

/** Returns the immediate next phase, or null if already closed. */
export function nextPhase(current: ResearchPhase): ResearchPhase | null {
  const idx = indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1] ?? null;
}

// ── canRunCommand ─────────────────────────────────────────────────────────────

export interface CommandPolicy {
  allowedPhases: ResearchPhase[];
  advancesTo: ResearchPhase | null;
  allowRerun: boolean;
  requiredFiles: string[];
  customCheck?: (thread: ResearchThread) => string | null;
}

export type ResearchCommand =
  | "new" | "scout" | "groom" | "alternatives"
  | "document" | "adr" | "rfc" | "design-doc" | "prd"
  | "oracle" | "contract" | "evaluate" | "status" | "resume";

export const COMMAND_POLICIES: Record<ResearchCommand, CommandPolicy> = {
  new:          { allowedPhases: [], advancesTo: null, allowRerun: true, requiredFiles: [] },
  status:       { allowedPhases: [], advancesTo: null, allowRerun: true, requiredFiles: [] },
  resume:       { allowedPhases: [], advancesTo: null, allowRerun: true, requiredFiles: [] },
  scout:        { allowedPhases: ["brief", "scout"], advancesTo: "scout", allowRerun: true, requiredFiles: ["brief.md"] },
  groom:        { allowedPhases: ["scout", "groom"], advancesTo: "groom", allowRerun: true, requiredFiles: ["brief.md"] },
  alternatives: { allowedPhases: ["groom", "alternatives"], advancesTo: "alternatives", allowRerun: true, requiredFiles: ["synthesis.md"] },
  document:     { allowedPhases: ["groom", "alternatives", "docs"], advancesTo: "docs", allowRerun: true, requiredFiles: ["synthesis.md"] },
  adr:          { allowedPhases: ["groom", "alternatives", "docs"], advancesTo: "docs", allowRerun: true, requiredFiles: ["synthesis.md"] },
  rfc:          { allowedPhases: ["groom", "alternatives", "docs"], advancesTo: "docs", allowRerun: true, requiredFiles: ["synthesis.md"] },
  "design-doc": { allowedPhases: ["groom", "alternatives", "docs"], advancesTo: "docs", allowRerun: true, requiredFiles: ["synthesis.md"] },
  prd: {
    allowedPhases: ["docs", "contract"],
    advancesTo: "docs",
    allowRerun: true,
    requiredFiles: ["synthesis.md"],
    customCheck: (t) => {
      const l = t.linkedDocs;
      return ((l.adr?.length ?? 0) > 0 || l.rfc || l.designDoc)
        ? null
        : "PRD requires a linked ADR, RFC, or Design Doc. Run one of those first.";
    },
  },
  oracle: {
    allowedPhases: ["alternatives", "docs", "contract", "evaluate"],
    advancesTo: null,
    allowRerun: true,
    requiredFiles: [],
    customCheck: (t) => {
      if (t.phase === "alternatives") return null; // alternatives.md checked at runtime
      const l = t.linkedDocs;
      return ((l.adr?.length ?? 0) > 0 || l.rfc || l.designDoc)
        ? null
        : "Oracle at after-doc gate requires a linked design doc, RFC, or ADR.";
    },
  },
  contract: {
    allowedPhases: ["docs", "contract"],
    advancesTo: "contract",
    allowRerun: true,
    requiredFiles: ["synthesis.md"],
    customCheck: (t) => {
      const l = t.linkedDocs;
      return ((l.adr?.length ?? 0) > 0 || l.rfc || l.designDoc)
        ? null
        : "Contract requires at least one linked doc (ADR/RFC/Design Doc).";
    },
  },
  evaluate: {
    allowedPhases: ["contract", "evaluate"],
    advancesTo: "evaluate",
    allowRerun: true,
    requiredFiles: [],
    customCheck: (t) =>
      t.linkedDocs.measurement
        ? null
        : "Evaluate requires a measurement contract. Run /research:contract first.",
  },
};

export interface CommandCheckResult {
  allowed: boolean;
  isRerun: boolean;
  errorMessage?: string;
}

export function canRunCommand(
  command: ResearchCommand,
  thread: ResearchThread,
  existingFiles: Set<string> = new Set()
): CommandCheckResult {
  const policy = COMMAND_POLICIES[command];

  // Always-allowed commands (empty allowedPhases)
  if (policy.allowedPhases.length === 0) {
    return { allowed: true, isRerun: false };
  }

  const inAllowed = policy.allowedPhases.includes(thread.phase);
  const currentIdx = indexOf(thread.phase);
  const maxAllowedIdx = Math.max(...policy.allowedPhases.map(indexOf));
  const isPast = currentIdx > maxAllowedIdx;

  if (!inAllowed && !isPast) {
    // Phase is before the allowed window (too early)
    return {
      allowed: false,
      isRerun: false,
      errorMessage: `Cannot run '${command}' in phase '${thread.phase}'. Allowed phases: ${policy.allowedPhases.join(", ")}.`,
    };
  }

  if (isPast && !policy.allowRerun) {
    return {
      allowed: false,
      isRerun: false,
      errorMessage: `Cannot re-run '${command}' — thread is already past this phase (current: '${thread.phase}').`,
    };
  }

  // Check required files
  for (const file of policy.requiredFiles) {
    if (!existingFiles.has(file)) {
      return {
        allowed: false,
        isRerun: false,
        errorMessage: `Required file not found: ${file}. Run earlier steps first.`,
      };
    }
  }

  // customCheck
  const customError = policy.customCheck?.(thread) ?? null;
  if (customError) {
    return { allowed: false, isRerun: false, errorMessage: customError };
  }

  return { allowed: true, isRerun: isPast };
}
