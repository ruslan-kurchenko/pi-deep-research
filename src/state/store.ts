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
}

const STATE_FILE = ".state.json";
const ACTIVE_FILE = "pi-deep-research-active.json";

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

export async function getActiveThread(globalStateDir: string): Promise<string | null> {
  try {
    const raw = await readFile(join(globalStateDir, ACTIVE_FILE), "utf8");
    return (JSON.parse(raw) as ActivePointer).threadId;
  } catch {
    return null;
  }
}

export async function setActiveThread(globalStateDir: string, threadId: string): Promise<void> {
  await mkdir(globalStateDir, { recursive: true });
  const ptr: ActivePointer = { threadId };
  await writeFile(join(globalStateDir, ACTIVE_FILE), JSON.stringify(ptr, null, 2));
}

export async function clearActiveThread(globalStateDir: string): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(join(globalStateDir, ACTIVE_FILE));
  } catch {
    // already gone — that's fine
  }
}
