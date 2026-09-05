import {
  getProcess,
  removeProcessByName,
  removeProcess,
  getAllProcesses,
  removeAllProcesses,
  updateProcessPid,
} from "../db";
import { isManagedProcessRunning, terminateProcess } from "../platform";
import {
  parseEnvString,
  acquireProcessOperationLock,
  getWatchedProcessName,
  isInternalProcessName,
} from "../utils";
import { announce, error } from "../logger";
import * as fs from "fs";
import { stopProcessWatcher } from "../watcher";

const BGR_PARENT_NAME_ENV = "BGR_PARENT_NAME";

export function getManagedChildProcesses(parentName: string) {
  return getAllProcesses().filter((proc) => {
    if (proc.name === parentName) return false;
    const env = proc.env ? parseEnvString(proc.env) : {};
    return env[BGR_PARENT_NAME_ENV] === parentName;
  });
}

export async function handleDelete(name: string) {
  const process = getProcess(name);

  if (!process) {
    error(`No process found named '${name}'`);
    return;
  }

  const isRunning = await isManagedProcessRunning(
    process.pid,
    name,
    process.command,
  );
  if (isRunning) {
    await terminateProcess(process.pid);
  }

  if (!isInternalProcessName(name)) {
    await stopProcessWatcher(name);
  }

  if (fs.existsSync(process.stdout_path)) {
    try {
      fs.unlinkSync(process.stdout_path);
    } catch {}
  }
  if (fs.existsSync(process.stderr_path)) {
    try {
      fs.unlinkSync(process.stderr_path);
    } catch {}
  }

  removeProcessByName(name);
  announce(
    `Process '${name}' has been ${isRunning ? "stopped and " : ""}deleted`,
    "Process Deleted",
  );
}

export async function handleClean() {
  const processes = getAllProcesses();
  let cleanedCount = 0;
  let deletedLogs = 0;

  for (const proc of processes) {
    const running = await isManagedProcessRunning(
      proc.pid,
      proc.name,
      proc.command,
    );
    if (!running) {
      const watched = getWatchedProcessName(proc.name);
      if (watched) {
        removeProcess(proc.pid);
        cleanedCount++;
        continue;
      }
      removeProcess(proc.pid);
      cleanedCount++;

      if (fs.existsSync(proc.stdout_path)) {
        try {
          fs.unlinkSync(proc.stdout_path);
          deletedLogs++;
        } catch {}
      }
      if (fs.existsSync(proc.stderr_path)) {
        try {
          fs.unlinkSync(proc.stderr_path);
          deletedLogs++;
        } catch {}
      }
    }
  }

  if (cleanedCount === 0) {
    announce("No stopped processes found to clean.", "Clean Complete");
  } else {
    announce(
      `Cleaned ${cleanedCount} stopped ${cleanedCount === 1 ? "process" : "processes"} and removed ${deletedLogs} log ${deletedLogs === 1 ? "file" : "files"}.`,
      "Clean Complete",
    );
  }
}

export async function handleStop(name: string, seen: Set<string> = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);

  const proc = getProcess(name);

  if (!proc) {
    error(`No process found named '${name}'`);
    return;
  }

  const releaseOperationLock = acquireProcessOperationLock(name);
  try {
    const childProcesses = getManagedChildProcesses(name);
    let stoppedChildren = 0;

    for (const child of childProcesses) {
      await handleStop(child.name, seen);
      stoppedChildren++;
    }

    const isRunning = await isManagedProcessRunning(
      proc.pid,
      name,
      proc.command,
    );
    if (!isRunning) {
      updateProcessPid(name, 0);
      announce(
        `Process '${name}' is already stopped${stoppedChildren > 0 ? `; stopped ${stoppedChildren} managed child ${stoppedChildren === 1 ? "process" : "processes"}` : ""}.`,
        "Process Stop",
      );
      return;
    }

    // Stop only the registered, command-verified PID. Never kill by port:
    // another service (for example Caddy) may legitimately connect to or later
    // own that port.
    await terminateProcess(proc.pid);

    // Mark PID as 0 — prevents reconcileProcessPids from re-attaching
    // a random matching process as this one
    updateProcessPid(name, 0);

    announce(
      `Process '${name}' has been stopped (kept in registry)${stoppedChildren > 0 ? `; stopped ${stoppedChildren} managed child ${stoppedChildren === 1 ? "process" : "processes"}` : ""}.`,
      "Process Stopped",
    );
  } finally {
    releaseOperationLock();
  }
}

export async function handleDeleteAll() {
  const processes = getAllProcesses();
  if (processes.length === 0) {
    announce("There are no processes to delete.", "Delete All");
    return;
  }

  let killedCount = 0;

  for (const proc of processes) {
    if (!isInternalProcessName(proc.name)) {
      await stopProcessWatcher(proc.name);
    }
    const running = await isManagedProcessRunning(
      proc.pid,
      proc.name,
      proc.command,
    );

    if (running) {
      // Force-kill only the registered, command-verified process tree.
      await terminateProcess(proc.pid, true);
      killedCount++;
    }

    // Clean up log files
    if (fs.existsSync(proc.stdout_path)) {
      try {
        fs.unlinkSync(proc.stdout_path);
      } catch {}
    }
    if (fs.existsSync(proc.stderr_path)) {
      try {
        fs.unlinkSync(proc.stderr_path);
      } catch {}
    }
  }

  removeAllProcesses();

  const parts = [
    `${processes.length} ${processes.length === 1 ? "process" : "processes"} deleted`,
  ];
  if (killedCount > 0) parts.push(`${killedCount} force-killed`);

  announce(parts.join(", ") + ".", "Nuke Complete");
}
