import chalk from "chalk";
import { renderProcessTable } from "../table";
import type { ProcessTableRow } from "../table";
import { getAllProcesses, updateProcessPid } from "../db";
import { announce } from "../logger";
import {
  isProcessRunning,
  calculateRuntime,
  parseEnvString,
  isInternalProcessName,
} from "../utils";
import {
  getProcessBatchResources,
  reconcileProcessPids,
  resolvePidWithPorts,
} from "../platform";

type ShowAllOptions = {
  json?: boolean;
  jsonFull?: boolean;
  filter?: string;
};

function formatMemory(bytes: number): string {
  if (bytes === 0) return "-";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function isPidAliveFast(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getFilteredProcesses(opts?: ShowAllOptions) {
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

  return Array.from(latestByName.values()).filter((proc) => {
    if (isInternalProcessName(proc.name)) return false;
    if (!opts?.filter) return true;
    const envVars = parseEnvString(proc.env);
    return envVars["BGR_GROUP"] === opts.filter;
  });
}

function parentNameFromEnv(envVars: Record<string, string>): string {
  return String(envVars.BGR_PARENT_NAME ?? envVars.BGRUN_PARENT_NAME ?? "");
}

function printFastJson(filtered: ReturnType<typeof getFilteredProcesses>) {
  const jsonData = filtered.map((proc) => {
    const envVars = parseEnvString(proc.env);
    const running = isPidAliveFast(proc.pid);
    return {
      pid: proc.pid,
      name: proc.name,
      status: running ? "running" : "stopped",
      statusSource: "pid-fast",
      healthChecked: false,
      commandVerified: false,
      parentName: parentNameFromEnv(envVars),
      group: envVars.BGR_GROUP ?? null,
      command: proc.command,
      workdir: proc.workdir,
      directory: proc.workdir,
      runtime: calculateRuntime(proc.timestamp),
      timestamp: proc.timestamp,
      env: envVars,
    };
  });

  console.log(JSON.stringify(jsonData, null, 2));
}

export async function showAll(opts?: ShowAllOptions) {
  const filtered = getFilteredProcesses(opts);

  // Keep `bgrun --json` fast. Scripts and guards often call it, so it must
  // not block on command-line verification, port discovery, memory checks,
  // or Windows PID reconciliation. Use `--json-full` for the slower rich path.
  if (opts?.json && !opts?.jsonFull) {
    printFastJson(filtered);
    return;
  }

  // ─── PID Reconciliation ──────────────────────────────────────────
  // On Windows, the stored PID may be a dead cmd.exe wrapper while the
  // actual bun.exe child is still running. Detect dead PIDs up-front,
  // reconcile them in one batch PowerShell call, and patch the DB so
  // subsequent invocations are stable (no flicker).
  const deadPids = new Set<number>();
  const aliveCache = new Map<number, boolean>();

  for (const proc of filtered) {
    const alive = await isProcessRunning(proc.pid, proc.command);
    aliveCache.set(proc.pid, alive);
    if (!alive && proc.pid > 0) deadPids.add(proc.pid);
  }

  if (deadPids.size > 0) {
    const reconciled = await reconcileProcessPids(
      filtered.map((p) => ({
        name: p.name,
        pid: p.pid,
        command: p.command,
        workdir: p.workdir,
      })),
      deadPids,
    );

    for (const [name, newPid] of reconciled) {
      updateProcessPid(name, newPid);
      const proc = filtered.find((p) => p.name === name);
      if (proc) {
        (proc as any).pid = newPid;
        aliveCache.set(newPid, true);
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────

  if (opts?.json) {
    const jsonData: any[] = [];

    for (const proc of filtered) {
      const isRunning =
        aliveCache.get(proc.pid) ??
        (await isProcessRunning(proc.pid, proc.command));
      const envVars = parseEnvString(proc.env);

      let displayPid = proc.pid;
      let ports: number[] = [];
      if (isRunning) {
        const resolved = await resolvePidWithPorts(proc.pid);
        displayPid = resolved.pid;
        ports = resolved.ports;
        if (displayPid !== proc.pid) {
          updateProcessPid(proc.name, displayPid);
          (proc as any).pid = displayPid;
        }
      }

      jsonData.push({
        pid: displayPid,
        name: proc.name,
        ports: ports.length > 0 ? ports : undefined,
        status: isRunning ? "running" : "stopped",
        statusSource: "command-verified",
        healthChecked: true,
        commandVerified: true,
        parentName: parentNameFromEnv(envVars),
        group: envVars.BGR_GROUP ?? null,
        command: proc.command,
        workdir: proc.workdir,
        directory: proc.workdir,
        runtime: calculateRuntime(proc.timestamp),
        timestamp: proc.timestamp,
        env: envVars,
      });
    }

    console.log(JSON.stringify(jsonData, null, 2));
    return;
  }

  const tableData: ProcessTableRow[] = [];
  const allPids = filtered.map((p) => p.pid);
  const resourceMap = await getProcessBatchResources(allPids);

  for (const proc of filtered) {
    const isRunning =
      aliveCache.get(proc.pid) ??
      (await isProcessRunning(proc.pid, proc.command));
    const runtime = calculateRuntime(proc.timestamp);

    let displayPid = proc.pid;
    let ports: number[] = [];
    if (isRunning) {
      const resolved = await resolvePidWithPorts(proc.pid);
      displayPid = resolved.pid;
      ports = resolved.ports;
      if (displayPid !== proc.pid) {
        updateProcessPid(proc.name, displayPid);
        (proc as any).pid = displayPid;
      }
    }

    const mem = isRunning
      ? resourceMap.get(displayPid)?.memory ||
        resourceMap.get(proc.pid)?.memory ||
        0
      : 0;
    tableData.push({
      id: proc.id,
      pid: displayPid,
      name: proc.name,
      port: ports.length > 0 ? ports.map((p) => `:${p}`).join(",") : "-",
      memory: formatMemory(mem),
      command: proc.command,
      workdir: proc.workdir,
      status: isRunning
        ? chalk.green.bold("● Running")
        : chalk.red.bold("○ Stopped"),
      runtime: runtime,
    });
  }

  if (tableData.length === 0) {
    if (opts?.filter) {
      announce(
        `No processes matched filter BGR_GROUP='${opts.filter}'.`,
        "No Matches",
      );
    } else {
      announce("No processes found.", "Empty");
    }
    return;
  }

  const tableOutput = renderProcessTable(tableData, {
    padding: 1,
    borderStyle: "rounded",
    showHeaders: true,
  });
  console.log(tableOutput);

  const runningCount = tableData.filter((p) =>
    p.status.includes("Running"),
  ).length;
  const stoppedCount = tableData.filter((p) =>
    p.status.includes("Stopped"),
  ).length;
  console.log(
    chalk.cyan(
      `Total: ${tableData.length} processes (${chalk.green(`${runningCount} running`)}, ${chalk.red(`${stoppedCount} stopped`)})`,
    ),
  );
}
