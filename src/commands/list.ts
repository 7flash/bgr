import chalk from "chalk";
import { renderProcessTable } from "../table";
import type { ProcessTableRow } from "../table";
import { bgrHome, dbPath, getAllProcesses, getDbInfo, updateProcessPid } from "../db";
import { announce } from "../logger";
import { calculateRuntime, isInternalProcessName, parseEnvString } from "../utils";
import {
  getProcessBatchResources,
  getProcessPorts,
  isProcessRunning,
  reconcileProcessPids,
} from "../platform";

type ListOptions = {
  json?: boolean;
  jsonFull?: boolean;
  jsonMeta?: boolean;
  filter?: string;
};

function formatMemory(bytes: number): string {
  if (bytes === 0) return "-";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function latestVisibleProcesses() {
  const processes = getAllProcesses();
  const latestByName = new Map<string, (typeof processes)[number]>();

  for (const proc of processes) {
    const existing = latestByName.get(proc.name);
    if (!existing) {
      latestByName.set(proc.name, proc);
      continue;
    }

    if (
      proc.timestamp > existing.timestamp ||
      (proc.timestamp === existing.timestamp && proc.id > existing.id)
    ) {
      latestByName.set(proc.name, proc);
    }
  }

  return [...latestByName.values()].filter((proc) => !isInternalProcessName(proc.name));
}

function filterByGroup<T extends { env: string }>(rows: T[], filter?: string): T[] {
  if (!filter) return rows;
  return rows.filter((proc) => {
    const envVars = parseEnvString(proc.env);
    return envVars["BGR_GROUP"] === filter;
  });
}

/**
 * Very fast PID existence check used by the default JSON path.
 *
 * This intentionally avoids command-line verification, port discovery, memory
 * checks, and Windows PowerShell reconciliation. `--json` is commonly used by
 * scripts/guards and must return quickly.
 *
 * For command-verified status, ports, memory, and PID reconciliation, use:
 *   bgrun --json-full
 */
function isPidAliveFast(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getListMeta(rows: unknown[]) {
  return {
    dbPath,
    bgrHome,
    bgrunDbEnv: process.env.BGRUN_DB ?? null,
    processCount: rows.length,
    generatedAt: new Date().toISOString(),
  };
}

function fastJsonRows(opts?: ListOptions) {
  const rows = filterByGroup(latestVisibleProcesses(), opts?.filter);

  return rows.map((proc) => {
    const env = parseEnvString(proc.env);
    const running = isPidAliveFast(proc.pid);

    return {
      id: proc.id,
      name: proc.name,
      pid: proc.pid,
      status: running ? "running" : "stopped",
      statusSource: "pid-fast",
      healthChecked: false,
      commandVerified: false,
      parentName: String(env.BGR_PARENT_NAME ?? env.BGRUN_PARENT_NAME ?? ""),
      group: env.BGR_GROUP ?? null,
      command: proc.command,
      workdir: proc.workdir,
      cwd: proc.workdir,
      directory: proc.workdir,
      env,
      stdout_path: proc.stdout_path,
      stderr_path: proc.stderr_path,
      timestamp: proc.timestamp,
      runtime: calculateRuntime(proc.timestamp),
    };
  });
}

async function fullJsonRows(opts?: ListOptions) {
  const rows = filterByGroup(latestVisibleProcesses(), opts?.filter);

  // PID reconciliation is intentionally only in the full/interactive path.
  const deadPids = new Set<number>();
  const aliveCache = new Map<number, boolean>();

  for (const proc of rows) {
    const alive = await isProcessRunning(proc.pid, proc.command);
    aliveCache.set(proc.pid, alive);
    if (!alive && proc.pid > 0) deadPids.add(proc.pid);
  }

  if (deadPids.size > 0) {
    const reconciled = await reconcileProcessPids(
      rows.map((p) => ({
        name: p.name,
        pid: p.pid,
        command: p.command,
        workdir: p.workdir,
      })),
      deadPids,
    );

    for (const [name, newPid] of reconciled) {
      updateProcessPid(name, newPid);
      const proc = rows.find((p) => p.name === name);
      if (proc) {
        aliveCache.delete(proc.pid);
        proc.pid = newPid;
        aliveCache.set(newPid, true);
      }
    }
  }

  const resources = await getProcessBatchResources(rows.map((p) => p.pid));

  return await Promise.all(
    rows.map(async (proc) => {
      const env = parseEnvString(proc.env);
      const alive =
        aliveCache.get(proc.pid) ?? (await isProcessRunning(proc.pid, proc.command));
      const ports = alive ? await getProcessPorts(proc.pid) : [];
      const resource = resources.get(proc.pid);

      return {
        id: proc.id,
        name: proc.name,
        pid: proc.pid,
        status: alive ? "running" : "stopped",
        statusSource: "command-verified",
        healthChecked: true,
        commandVerified: true,
        parentName: String(env.BGR_PARENT_NAME ?? env.BGRUN_PARENT_NAME ?? ""),
        group: env.BGR_GROUP ?? null,
        command: proc.command,
        workdir: proc.workdir,
        cwd: proc.workdir,
        directory: proc.workdir,
        env,
        port: ports.join(", "),
        ports,
        memory: resource?.memory ?? 0,
        memoryText: formatMemory(resource?.memory ?? 0),
        stdout_path: proc.stdout_path,
        stderr_path: proc.stderr_path,
        timestamp: proc.timestamp,
        runtime: calculateRuntime(proc.timestamp),
      };
    }),
  );
}

export async function showAll(opts?: ListOptions) {
  if (opts?.json) {
    const rows = opts.jsonFull ? await fullJsonRows(opts) : fastJsonRows(opts);

    if (opts.jsonMeta) {
      console.log(
        JSON.stringify(
          {
            meta: {
              ...getListMeta(rows),
              mode: opts.jsonFull ? "full" : "fast",
              dbInfo: getDbInfo(),
            },
            processes: rows,
          },
          null,
          2,
        ),
      );
      return;
    }

    // Backward-compatible array output for scripts:
    //   bunx bgrun --json | ConvertFrom-Json
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  // Interactive/table path keeps the richer full status.
  const rows = await fullJsonRows(opts);

  if (rows.length === 0) {
    announce(
      `No processes found.\n\nDB: ${dbPath}\nBGRUN_DB: ${process.env.BGRUN_DB ?? "(default bgrun.sqlite)"}`,
      "No Processes",
    );
    return;
  }

  const tableRows: ProcessTableRow[] = rows.map((proc: any) => ({
    id: proc.id,
    pid: proc.pid,
    name: proc.name,
    port: proc.port || "",
    command: proc.command,
    workdir: proc.workdir,
    status:
      proc.status === "running"
        ? chalk.green.bold("● Running")
        : chalk.red.bold("○ Stopped"),
    runtime: proc.runtime,
    memory: proc.memoryText,
  }));

  console.log(renderProcessTable(tableRows));
}
