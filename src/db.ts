import { Database, z } from "sqlite-zod-orm";
import { getHomeDir, ensureDir } from "./platform";
import { join } from "path";
import { existsSync, copyFileSync } from "fs";
import { retry } from "./async-utils";
import { hasErrorCode } from "./error-utils";
import { dbMeasure, measureRequired } from "./observability";
import { selectLatestByName } from "./process-records";

// =============================================================================
// SCHEMA (inline — single table, no need for a separate file)
// =============================================================================

export const ProcessSchema = z.object({
  pid: z.number(),
  workdir: z.string(),
  command: z.string(),
  name: z.string(),
  env: z.string(),
  configPath: z.string().default(""),
  stdout_path: z.string(),
  stderr_path: z.string(),
  timestamp: z.string().default(() => new Date().toISOString()),
  group: z.string().default(""),
});

export type Process = z.infer<typeof ProcessSchema> & { id: number };

export const TemplateSchema = z.object({
  name: z.string(),
  command: z.string(),
  workdir: z.string().default(""),
  env: z.string().default(""),
  group: z.string().default(""),
  created_at: z.string().default(() => new Date().toISOString()),
});

export type Template = z.infer<typeof TemplateSchema> & { id: number };

export const HistorySchema = z.object({
  process_name: z.string(),
  event: z.string(), // 'start', 'stop', 'restart', 'crash', 'guard_on', 'guard_off'
  pid: z.number().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
  metadata: z.string().default(""), // JSON string for extra info
});

export type History = z.infer<typeof HistorySchema> & { id: number };

export const DependencySchema = z.object({
  process_name: z.string(), // the process that has the dependency
  depends_on: z.string(), // the process it depends on
  created_at: z.string().default(() => new Date().toISOString()),
});

export type Dependency = z.infer<typeof DependencySchema> & { id: number };

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

const homePath = getHomeDir();
const bgrDir = join(homePath, ".bgr");
ensureDir(bgrDir);

// DB filename: configurable via BGRUN_DB env, default "bgrun.sqlite"
const dbFilename = process.env.BGRUN_DB ?? "bgrun.sqlite";
export const dbPath = join(bgrDir, dbFilename);
export const bgrHome = bgrDir;

function shouldAutoMigrateLegacyDb() {
  const raw = (process.env.BGRUN_DISABLE_LEGACY_MIGRATION || "")
    .trim()
    .toLowerCase();
  return !(raw === "1" || raw === "true" || raw === "yes");
}

// Auto-migration: if new DB doesn't exist but old one does, copy it over
const legacyDbPath = join(bgrDir, "bgr_v2.sqlite");
if (
  shouldAutoMigrateLegacyDb() &&
  !existsSync(dbPath) &&
  existsSync(legacyDbPath)
) {
  try {
    copyFileSync(legacyDbPath, dbPath);
    console.log(`[bgrun] Migrated database: ${legacyDbPath} → ${dbPath}`);
  } catch (e) {
    // Migration failed — start fresh
  }
}

export const db = new Database(
  dbPath,
  {
    process: ProcessSchema,
    template: TemplateSchema,
    history: HistorySchema,
    dependency: DependencySchema,
  },
  {
    indexes: {
      process: ["name", "timestamp", "pid"],
      template: ["name"],
      history: ["process_name", "timestamp"],
      dependency: ["process_name", "depends_on"],
    },
  },
);

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

export function getProcess(name: string): Process | null {
  return (
    db.process
      .select()
      .where({ name })
      .orderBy("timestamp", "desc")
      .limit(1)
      .get() || null
  );
}

/** Raw process rows, including historical duplicates. Prefer getCurrentProcesses() for runtime behavior. */
export function getAllProcesses(): Process[] {
  return db.process.select().all();
}

/**
 * Return one canonical row per process name.
 *
 * Process rows are append-oriented, so callers should not each reimplement the
 * "latest row wins" rule. Keeping it here prevents list/dashboard/guard code
 * from disagreeing about which row represents a process.
 */
export function getCurrentProcesses(): Process[] {
  return selectLatestByName(getAllProcesses());
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

export function insertProcess(data: {
  pid: number;
  workdir: string;
  command: string;
  name: string;
  env: string;
  configPath: string;
  stdout_path: string;
  stderr_path: string;
}) {
  return db.process.insert({
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function removeProcess(pid: number) {
  const matches = db.process.select().where({ pid }).all();
  for (const p of matches) {
    db.process.delete(p.id);
  }
}

export function removeProcessByName(name: string) {
  const matches = db.process.select().where({ name }).all();
  for (const p of matches) {
    db.process.delete(p.id);
  }
}

/** Update the stored PID for a process (used by PID reconciliation) */
export function updateProcessPid(name: string, newPid: number) {
  const proc = getProcess(name);
  if (proc) {
    proc.update({ pid: newPid });
  }
}

export function removeAllProcesses() {
  const all = db.process.select().all();
  for (const p of all) {
    db.process.delete(p.id);
  }
}

/** Update the stored env JSON for a process (used by guard toggle) */
export function updateProcessEnv(name: string, envJson: string) {
  const proc = getProcess(name);
  if (proc) {
    proc.update({ env: envJson });
  }
}

// =============================================================================
// TEMPLATE FUNCTIONS
// =============================================================================

export function getAllTemplates() {
  return db.template.select().all();
}

export function getTemplate(name: string) {
  return db.template.select().where({ name }).limit(1).get() || null;
}

export function saveTemplate(data: {
  name: string;
  command: string;
  workdir?: string;
  env?: string;
  group?: string;
}) {
  const existing = db.template
    .select()
    .where({ name: data.name })
    .limit(1)
    .get();
  if (existing) {
    db.template.update(existing.id, {
      command: data.command,
      workdir: data.workdir || "",
      env: data.env || "",
      group: data.group || "",
    });
  } else {
    db.template.insert({
      name: data.name,
      command: data.command,
      workdir: data.workdir || "",
      env: data.env || "",
      group: data.group || "",
    });
  }
}

export function deleteTemplate(name: string) {
  const tmpl = db.template.select().where({ name }).limit(1).get();
  if (tmpl) {
    db.template.delete(tmpl.id);
  }
}

// =============================================================================
// HISTORY FUNCTIONS
// =============================================================================

export function getProcessHistory(name: string, limit = 50): History[] {
  return db.history
    .select()
    .where({ process_name: name })
    .orderBy("timestamp", "desc")
    .limit(limit)
    .all();
}

export function addHistoryEntry(
  processName: string,
  event: string,
  pid?: number,
  metadata: Record<string, unknown> = {},
) {
  return db.history.insert({
    process_name: processName,
    event,
    pid,
    metadata: JSON.stringify(metadata),
  });
}

export function getRecentHistory(limit = 100): History[] {
  return db.history.select().orderBy("timestamp", "desc").limit(limit).all();
}

export function getHistoryByEvent(event: string): History[] {
  return db.history.select().where({ event }).all();
}

export function getRecentHistoryByEvents(
  events: readonly string[],
  limit = 100,
): History[] {
  if (limit <= 0 || events.length === 0) return [];
  const eventSet = new Set(events);

  // The ORM does not expose an IN helper here, so keep filtering inside the DB
  // repository rather than leaking storage details into watcher/API modules.
  return db.history
    .select()
    .orderBy("timestamp", "desc")
    .limit(Math.max(limit * 4, limit))
    .all()
    .filter((row) => eventSet.has(row.event))
    .slice(0, limit);
}

export function clearOldHistory(daysToKeep = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const cutoffStr = cutoff.toISOString();

  const oldEntries = db.history
    .select()
    .where("timestamp", "<", cutoffStr)
    .all();

  for (const entry of oldEntries) {
    db.history.delete(entry.id);
  }

  return oldEntries.length;
}

// =============================================================================
// DEPENDENCY FUNCTIONS
// =============================================================================

/** Get all dependencies for a process */
export function getDependencies(processName: string): string[] {
  return db.dependency
    .select()
    .where({ process_name: processName })
    .all()
    .map((d) => d.depends_on);
}

/** Get all processes that depend on a given process */
export function getDependents(processName: string): string[] {
  return db.dependency
    .select()
    .where({ depends_on: processName })
    .all()
    .map((d) => d.process_name);
}

/** Get the full dependency graph: { processName -> [dependsOn...] } */
export function getDependencyGraph(): Record<string, string[]> {
  const all = db.dependency.select().all();
  const graph: Record<string, string[]> = {};
  for (const dep of all) {
    if (!graph[dep.process_name]) graph[dep.process_name] = [];
    graph[dep.process_name].push(dep.depends_on);
  }
  return graph;
}

/** Add a dependency (process_name depends on depends_on) */
export function addDependency(processName: string, dependsOn: string): boolean {
  // Prevent self-dependency
  if (processName === dependsOn) return false;

  // Prevent duplicates
  const existing = db.dependency
    .select()
    .where({ process_name: processName, depends_on: dependsOn })
    .limit(1)
    .get();
  if (existing) return false;

  // Prevent circular dependencies
  if (wouldCreateCycle(processName, dependsOn)) return false;

  db.dependency.insert({ process_name: processName, depends_on: dependsOn });
  return true;
}

/** Remove a dependency */
export function removeDependency(processName: string, dependsOn: string) {
  const matches = db.dependency
    .select()
    .where({ process_name: processName, depends_on: dependsOn })
    .all();
  for (const dep of matches) {
    db.dependency.delete(dep.id);
  }
}

/** Remove all dependencies for a process */
export function removeAllDependencies(processName: string) {
  const matches = db.dependency
    .select()
    .where({ process_name: processName })
    .all();
  for (const dep of matches) {
    db.dependency.delete(dep.id);
  }
}

/** Check if adding processName -> dependsOn would create a cycle */
function wouldCreateCycle(processName: string, dependsOn: string): boolean {
  const graph = getDependencyGraph();
  // Add the proposed edge temporarily
  if (!graph[processName]) graph[processName] = [];
  graph[processName].push(dependsOn);

  // DFS from dependsOn — if we can reach processName, it's a cycle
  const visited = new Set<string>();
  const stack = [dependsOn];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === processName) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const dep of graph[current] || []) {
      stack.push(dep);
    }
  }
  return false;
}

/** Get topological start order (processes with no deps first) */
export function getStartOrder(): string[] {
  const graph = getDependencyGraph();
  const allProcesses = getCurrentProcesses().map((p) => p.name);
  const allNames = new Set(allProcesses);

  // Build in-degree map
  const inDegree: Record<string, number> = {};
  for (const name of allNames) inDegree[name] = 0;
  for (const [proc, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (allNames.has(dep)) {
        inDegree[proc] = (inDegree[proc] || 0) + 1;
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const name of allNames) {
    if ((inDegree[name] || 0) === 0) queue.push(name);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    queue.sort(); // stable alphabetical within same level
    const current = queue.shift()!;
    order.push(current);
    // Find processes that depend on current
    for (const [proc, deps] of Object.entries(graph)) {
      if (deps.includes(current) && allNames.has(proc)) {
        inDegree[proc]--;
        if (inDegree[proc] === 0) queue.push(proc);
      }
    }
  }

  return order;
}

// =============================================================================
// DEBUG / INFO
// =============================================================================

export function getDbInfo() {
  return {
    dbPath,
    bgrHome,
    dbFilename,
    exists: existsSync(dbPath),
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

export async function retryDatabaseOperation<T>(
  operation: () => T | Promise<T>,
  maxRetries = 5,
  delay = 100,
): Promise<T> {
  return measureRequired(dbMeasure.measure, "Retryable database write", () =>
    retry(operation, {
      attempts: maxRetries,
      delayMs: delay,
      shouldRetry: (error) => hasErrorCode(error, "SQLITE_BUSY"),
    }),
  );
}
