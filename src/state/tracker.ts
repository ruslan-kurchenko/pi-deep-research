import type { ResearchPhase } from "./store.js";

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
