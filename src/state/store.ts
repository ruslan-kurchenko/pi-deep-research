import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { threadDir } from "../lib/paths.js";

export type ResearchPhase =
  | "brief"
  | "scout"
  | "groom"
  | "alternatives"
  | "docs"
  | "contract"
  | "evaluate"
  | "closed";

export interface ModelUsageEntry {
  agent: string;
  model: string;
  command: string;
  timestamp: string;
}

export type OracleDecision =
  | "accept_all"
  | "accept_some"
  | "dismiss"
  | "iterate";

export interface OracleReview {
  gate: string;
  outputPath: string;
  verdict?: string;
  operatorDecision?: OracleDecision;
  timestamp: string;
}

export interface ResearchThread {
  id: string;
  topic: string;
  scope: string[];
  phase: ResearchPhase;
  createdAt: string;
  linkedDocs: Partial<{
    adr: string[];
    rfc: string;
    designDoc: string;
    prd: string;
    measurement: string;
    evaluation: string;
  }>;
  /** Audit log of every subagent dispatch (agent, model, command, timestamp). */
  modelUsage: ModelUsageEntry[];
  /** Operator-confirmed fallback per provider (cached to avoid re-prompting). */
  modelFallbacks: Record<string, string>;
  /** Oracle review entries per gate. */
  oracleReviews: OracleReview[];
}

const STATE_FILE = ".state.json";
/** Project-local active-thread pointer. Stored inside the project, not globally. */
const ACTIVE_FILE = join(".pi", "deep-research", "active.json");

// ── per-thread state ──────────────────────────────────────────────────────────

export async function createThread(
  projectRoot: string,
  id: string,
  topic: string,
  scope: string[]
): Promise<ResearchThread> {
  const dir = threadDir(projectRoot, id);
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, "raw"), { recursive: true });
  await mkdir(join(dir, "cross-checks"), { recursive: true });

  const thread: ResearchThread = {
    id,
    topic,
    scope,
    phase: "brief",
    createdAt: new Date().toISOString(),
    linkedDocs: {},
    modelUsage: [],
    modelFallbacks: {},
    oracleReviews: [],
  };

  await writeFile(join(dir, STATE_FILE), JSON.stringify(thread, null, 2));
  return thread;
}

export async function getThread(
  projectRoot: string,
  id: string
): Promise<ResearchThread | null> {
  const file = join(threadDir(projectRoot, id), STATE_FILE);
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as ResearchThread;
  } catch {
    return null;
  }
}

export async function updateThreadPhase(
  projectRoot: string,
  id: string,
  phase: ResearchPhase
): Promise<void> {
  const thread = await getThread(projectRoot, id);
  if (!thread) throw new Error(`Thread not found: ${id}`);
  thread.phase = phase;
  const file = join(threadDir(projectRoot, id), STATE_FILE);
  await writeFile(file, JSON.stringify(thread, null, 2));
}

export async function logModelUsage(
  projectRoot: string,
  id: string,
  entry: ModelUsageEntry
): Promise<void> {
  const thread = await getThread(projectRoot, id);
  if (!thread) throw new Error(`Thread not found: ${id}`);
  thread.modelUsage = [...(thread.modelUsage ?? []), entry];
  const file = join(threadDir(projectRoot, id), STATE_FILE);
  await writeFile(file, JSON.stringify(thread, null, 2));
}

export async function logOracleReview(
  projectRoot: string,
  id: string,
  review: OracleReview
): Promise<void> {
  const thread = await getThread(projectRoot, id);
  if (!thread) throw new Error(`Thread not found: ${id}`);
  thread.oracleReviews = [...(thread.oracleReviews ?? []), review];
  const file = join(threadDir(projectRoot, id), STATE_FILE);
  await writeFile(file, JSON.stringify(thread, null, 2));
}

export async function updateThreadFallbacks(
  projectRoot: string,
  id: string,
  fallbacks: Record<string, string>
): Promise<void> {
  const thread = await getThread(projectRoot, id);
  if (!thread) throw new Error(`Thread not found: ${id}`);
  thread.modelFallbacks = { ...(thread.modelFallbacks ?? {}), ...fallbacks };
  const file = join(threadDir(projectRoot, id), STATE_FILE);
  await writeFile(file, JSON.stringify(thread, null, 2));
}

export async function updateThreadLinks(
  projectRoot: string,
  id: string,
  links: ResearchThread["linkedDocs"]
): Promise<void> {
  const thread = await getThread(projectRoot, id);
  if (!thread) throw new Error(`Thread not found: ${id}`);
  thread.linkedDocs = { ...thread.linkedDocs, ...links };
  const file = join(threadDir(projectRoot, id), STATE_FILE);
  await writeFile(file, JSON.stringify(thread, null, 2));
}

export async function listThreads(projectRoot: string): Promise<ResearchThread[]> {
  const dir = join(projectRoot, "research");
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const threads: ResearchThread[] = [];
  for (const entry of entries.sort()) {
    if (!/^\d{3,}-/.test(entry)) continue;
    const t = await getThread(projectRoot, entry);
    if (t) threads.push(t);
  }
  return threads;
}

// ── global active-thread pointer ─────────────────────────────────────────────

interface ActivePointer {
  threadId: string;
}

/**
 * Get the active thread for the given project.
 * Pointer is stored at <projectRoot>/.pi/deep-research/active.json (project-scoped).
 * Falls back to the legacy global pointer for migration compatibility.
 */
export async function getActiveThread(projectRoot: string): Promise<string | null> {
  // Project-local (new location)
  try {
    const raw = await readFile(join(projectRoot, ACTIVE_FILE), "utf8");
    return (JSON.parse(raw) as ActivePointer).threadId;
  } catch {
    // fall through to legacy
  }
  // Legacy global location — migrate on next setActiveThread
  try {
    const { homedir } = await import("node:os");
    const legacyPath = join(homedir(), ".pi", "agent", "state", "pi-deep-research-active.json");
    const raw = await readFile(legacyPath, "utf8");
    const id = (JSON.parse(raw) as ActivePointer).threadId;
    // Only return the legacy pointer if that thread actually exists in this project
    const thread = await getThread(projectRoot, id);
    return thread ? id : null;
  } catch {
    return null;
  }
}

/**
 * Set the active thread for the given project.
 * Writes to <projectRoot>/.pi/deep-research/active.json (project-scoped).
 */
export async function setActiveThread(projectRoot: string, threadId: string): Promise<void> {
  const dir = join(projectRoot, ".pi", "deep-research");
  await mkdir(dir, { recursive: true });
  const ptr: ActivePointer = { threadId };
  await writeFile(join(projectRoot, ACTIVE_FILE), JSON.stringify(ptr, null, 2));
}

export async function clearActiveThread(projectRoot: string): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(join(projectRoot, ACTIVE_FILE));
  } catch {
    // already gone — that's fine
  }
}
