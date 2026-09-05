import { getAllProcesses } from "../db";
import {
  isProcessRunning,
  calculateRuntime,
  parseEnvString,
  isInternalProcessName,
} from "../utils";
import { getProcessBatchResources, resolvePidWithPorts } from "../platform";

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

  // Status is read-only. Never reconcile a stale PID by scanning unrelated
  // processes; a stale row should display as stopped instead of being silently
  // attached to another live service.
  const aliveCache = new Map<number, boolean>();
  for (const proc of filtered) {
    aliveCache.set(proc.pid, await isProcessRunning(proc.pid, proc.command));
  }

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

  const allPids = filtered.map((p) => p.pid);
  const resourceMap = await getProcessBatchResources(allPids);
  const lines: string[] = [];

  for (const proc of filtered) {
    const isRunning =
      aliveCache.get(proc.pid) ??
      (await isProcessRunning(proc.pid, proc.command));
    const runtime = calculateRuntime(proc.timestamp);

    const displayPid = proc.pid;
    const mem = isRunning ? resourceMap.get(proc.pid)?.memory || 0 : 0;
    const status = isRunning ? "running" : "stopped";
    const pidText = isRunning ? `pid=${displayPid}` : "pid=-";
    const memText = isRunning ? formatMemory(mem) : "-";
    lines.push(`${proc.name}  ${status}  ${pidText}  ${memText}  ${runtime}`);
  }

  if (lines.length === 0) {
    console.log(opts?.filter ? "no matching processes" : "no processes");
    return;
  }

  console.log(lines.join("\n"));
}
