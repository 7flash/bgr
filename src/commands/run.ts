import type { CommandOptions } from "../types";
import {
  getProcess,
  removeProcessByName,
  retryDatabaseOperation,
  insertProcess,
} from "../db";
import {
  isProcessRunning,
  isManagedProcessRunning,
  terminateProcess,
  getHomeDir,
  getShellCommand,
  findChildPid,
  psExec,
  findManagedProcessPid,
  clearProcessRunningCache,
} from "../platform";
import { error, announce } from "../logger";
import {
  validateDirectory,
  parseEnvString,
  buildManagedProcessEnv,
  acquireProcessOperationLock,
  isInternalProcessName,
  stringifyEnvString,
} from "../utils";
import { parseConfigFile } from "../config";
import { sleep } from "bun";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { runMeasure as run, measureRequired } from "../observability";
import { syncProcessWatcher } from "../watcher";

const homePath = getHomeDir();
const INTERNAL_BUNX_PREFIX = "bunx bgrun";
const STARTUP_HEALTH_GRACE_MS = Number(
  Bun.env.BGR_STARTUP_HEALTH_GRACE_MS || "1500",
);
const BGR_PROCESS_NAME_ENV = "BGR_PROCESS_NAME";
const BGR_PARENT_NAME_ENV = "BGR_PARENT_NAME";

function attachManagedProcessMetadata(
  env: Record<string, string>,
  processName: string,
): Record<string, string> {
  const nextEnv = { ...env };
  const inheritedParentName = Bun.env[BGR_PROCESS_NAME_ENV];

  if (
    inheritedParentName &&
    inheritedParentName !== processName &&
    !nextEnv[BGR_PARENT_NAME_ENV]
  ) {
    nextEnv[BGR_PARENT_NAME_ENV] = inheritedParentName;
  }

  nextEnv[BGR_PROCESS_NAME_ENV] = processName;
  return nextEnv;
}

function readStartupLogTail(filePath: string, maxLines = 20): string {
  try {
    if (!existsSync(filePath)) return "";
    return readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .slice(-maxLines)
      .join("\n")
      .trim();
  } catch {
    return "";
  }
}

function formatStartupFailureMessage(
  name: string,
  stdoutPath: string,
  stderrPath: string,
): string {
  const stderrTail = readStartupLogTail(stderrPath);
  const stdoutTail = readStartupLogTail(stdoutPath);
  const logSections = [
    stderrTail ? `\nstderr tail:\n${stderrTail}` : "",
    stdoutTail ? `\nstdout tail:\n${stdoutTail}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    `Process "${name}" failed to stay running after launch. ` +
    `The child process likely exited during startup.\n` +
    `stdout: ${stdoutPath}\n` +
    `stderr: ${stderrPath}` +
    logSections
  );
}

async function waitForStartupHealth(
  pid: number,
  command: string,
  graceMs = STARTUP_HEALTH_GRACE_MS,
): Promise<boolean> {
  if (pid <= 0) return false;
  const deadline = Date.now() + Math.max(0, graceMs);

  do {
    clearProcessRunningCache(pid);
    if (!(await isProcessRunning(pid, command))) {
      return false;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(500, remaining));
  } while (Date.now() < deadline);

  clearProcessRunningCache(pid);
  return await isProcessRunning(pid, command);
}

async function resolveSpawnedProcessPid(
  parentPid: number,
  command: string,
  workdir: string,
  processName: string,
): Promise<number> {
  if (parentPid <= 0) return 0;

  let candidatePid = parentPid;
  const spawnedAt = Date.now();

  // Reduce attempts from 6 to 3, sleep from 250ms to 100ms
  // This gives up to 300ms for the process to spawn, which is usually sufficient
  for (let attempt = 0; attempt < 3; attempt++) {
    const descendantPid = await findChildPid(parentPid);
    if (descendantPid > 0) {
      candidatePid = descendantPid;
    }

    if (candidatePid > 0 && (await isProcessRunning(candidatePid, command))) {
      return candidatePid;
    }

    await sleep(100);
  }

  const managedPid = await findManagedProcessPid(processName, command, workdir);
  if (managedPid) return managedPid;

  if (process.platform === "win32") {
    try {
      const commandParts = command
        .toLowerCase()
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 2);
      const output = await psExec(
        `Get-CimInstance Win32_Process -Filter "Name='bun.exe'" | ` +
          `ForEach-Object { Write-Output "$($_.ProcessId)|$($_.ParentProcessId)|$($_.CreationDate)|$($_.CommandLine)" }`,
        5000,
      );

      let bestPid = 0;
      let bestScore = -1;

      for (const line of output.split("\n")) {
        const parts = line.split("|");
        if (parts.length < 4) continue;
        const pid = parseInt(parts[0]?.trim(), 10);
        const candidateParentPid = parseInt(parts[1]?.trim(), 10);
        const creationDateRaw = parts[2]?.trim() || "";
        const candidateCommand = parts.slice(3).join("|").trim().toLowerCase();
        if (isNaN(pid) || pid <= 0 || pid === process.pid) continue;
        if (!candidateCommand) continue;

        let score = 0;
        if (candidateParentPid === parentPid) score += 10;
        for (const part of commandParts) {
          if (candidateCommand.includes(part)) score += 2;
        }
        if (candidateCommand.includes("run server.ts")) score += 2;
        if (
          candidateCommand.includes(workdir.toLowerCase().replace(/\\/g, "/"))
        )
          score += 4;
        if (candidateCommand.includes(workdir.toLowerCase())) score += 4;

        const createdAt = creationDateRaw ? Date.parse(creationDateRaw) : NaN;
        if (!isNaN(createdAt)) {
          const ageMs = Math.abs(createdAt - spawnedAt);
          if (ageMs <= 15_000) score += 6;
          else if (ageMs <= 60_000) score += 2;
        }

        if (score > bestScore && (await isProcessRunning(pid, command))) {
          bestScore = score;
          bestPid = pid;
        }
      }

      if (bestScore >= 4) {
        return bestPid;
      }
    } catch {
      // best effort
    }
  }

  return 0;
}

async function runGit(directory: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdoutText, stderrText] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new Error(stderrText.trim() || `git ${args.join(" ")} failed`);
  }

  return stdoutText.trim();
}

async function updateGitCheckout(directory: string): Promise<boolean> {
  if (!existsSync(join(directory, ".git"))) {
    throw new Error(`Cannot --fetch: '${directory}' is not a Git repository.`);
  }

  await runGit(directory, ["fetch", "origin"]);
  const localHash = await runGit(directory, ["rev-parse", "HEAD"]);
  const branch = await runGit(directory, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const remoteHash = await runGit(directory, ["rev-parse", `origin/${branch}`]);

  if (localHash === remoteHash) return false;
  await runGit(directory, ["pull", "origin", branch]);
  return true;
}

export function resolveInternalBgrunCommand(command: string): string {
  const trimmed = command.trim();
  if (
    !trimmed.startsWith("bgrun --_") &&
    !trimmed.startsWith(`${INTERNAL_BUNX_PREFIX} --_`)
  ) {
    return command;
  }

  if (trimmed.startsWith(`${INTERNAL_BUNX_PREFIX} --_`)) {
    return trimmed;
  }

  return `${INTERNAL_BUNX_PREFIX}${trimmed.slice("bgrun".length)}`;
}

export async function handleRun(options: CommandOptions) {
  const {
    command,
    directory,
    env,
    name,
    configPath,
    force,
    fetch,
    logsDir,
    stdout,
    stderr,
  } = options;
  const releaseOperationLock = name
    ? acquireProcessOperationLock(name)
    : () => {};

  try {
    const existingProcess = name ? getProcess(name) : null;

    // Auto-start unmet dependencies before starting this process
    if (name && existingProcess) {
      const { getUnmetDeps } = await import("../deps");
      const unmet = await getUnmetDeps(name);
      if (unmet.length > 0) {
        await measureRequired(
          run.measure,
          `Start ${unmet.length} dependencies for "${name}"`,
          async () => {
            for (const depName of unmet) {
              const depProc = getProcess(depName);
              if (depProc) {
                announce(
                  `📦 Starting dependency "${depName}" for "${name}"`,
                  "Dependency",
                );
                await handleRun({
                  action: "run",
                  name: depName,
                  force: true,
                  remoteName: "",
                });
              }
            }
          },
        );
      }
    }

    if (existingProcess) {
      const finalDirectory = directory || existingProcess.workdir;
      validateDirectory(finalDirectory);

      if (fetch) {
        const updated = await measureRequired(
          run.measure,
          `Git sync "${name}"`,
          () => updateGitCheckout(finalDirectory),
        );
        if (updated) announce("📥 Pulled latest changes", "Git Update");
      }

      const isRunning = await isManagedProcessRunning(
        existingProcess.pid,
        name!,
        existingProcess.command,
      );
      if (isRunning && !force) {
        error(
          `Process '${name}' is currently running. Use --force to restart.`,
        );
      }

      // Never search the machine for a "similar" process during restart.
      // A stale row must remain stale rather than being attached to another app.
      // Only the stored PID is eligible for termination, and only when its
      // command still verifies as the process bgrun originally registered.
      if (isRunning) {
        await measureRequired(
          run.measure,
          `Terminate "${name}" (PID ${existingProcess.pid})`,
          async () => {
            await terminateProcess(existingProcess.pid, true);
          },
        );
      }

      // Do not kill by port here. Port ownership is not process ownership: a
      // reverse proxy such as Caddy can have client connections to the same
      // port, and a stale declared port may now belong to another service.
      // If the port is still occupied, the new process will fail normally and
      // surface a clear startup error without bgrun killing unrelated PIDs.

      await retryDatabaseOperation(() => removeProcessByName(name!));
    } else {
      if (!directory || !name || !command) {
        error(
          "'directory', 'name', and 'command' parameters are required for new processes.",
        );
      }
      validateDirectory(directory!);
    }

    const storedCommand = command || existingProcess!.command;
    const finalCommand = resolveInternalBgrunCommand(storedCommand);
    const finalDirectory = directory || existingProcess?.workdir!;
    let finalEnv =
      env || (existingProcess ? parseEnvString(existingProcess.env) : {});

    let finalConfigPath: string | undefined | null;
    if (configPath !== undefined) {
      finalConfigPath = configPath;
    } else if (existingProcess) {
      finalConfigPath = existingProcess.configPath;
    } else {
      finalConfigPath = ".config.toml";
    }

    if (finalConfigPath) {
      const fullConfigPath = join(finalDirectory, finalConfigPath);

      if (await Bun.file(fullConfigPath).exists()) {
        const configEnv = await run.measure(
          `Parse config "${finalConfigPath}"`,
          async () => {
            try {
              return await parseConfigFile(fullConfigPath);
            } catch (err: any) {
              console.warn(
                `Warning: Failed to parse config file ${finalConfigPath}: ${err.message}`,
              );
              return null;
            }
          },
        );
        if (configEnv) {
          finalEnv = { ...finalEnv, ...configEnv };
          console.log(`Loaded config from ${finalConfigPath}`);
        }
      } else {
        console.log(
          `Config file '${finalConfigPath}' not found, continuing without it.`,
        );
      }
    }

    finalEnv = attachManagedProcessMetadata(finalEnv, name!);

    const stdoutPath =
      stdout ||
      (logsDir ? join(logsDir, `${name}-out.txt`) : undefined) ||
      existingProcess?.stdout_path ||
      join(homePath, ".bgr", `${name}-out.txt`);
    mkdirSync(dirname(stdoutPath), { recursive: true });
    const stderrPath =
      stderr ||
      (logsDir ? join(logsDir, `${name}-err.txt`) : undefined) ||
      existingProcess?.stderr_path ||
      join(homePath, ".bgr", `${name}-err.txt`);
    mkdirSync(dirname(stderrPath), { recursive: true });
    await measureRequired(run.measure, `Prepare logs "${name}"`, () =>
      Promise.all([Bun.write(stdoutPath, ""), Bun.write(stderrPath, "")]),
    );

    const actualPid = await measureRequired(
      run.measure,
      `Spawn "${name}" → ${finalCommand}`,
      async () => {
        const newProcess = Bun.spawn(getShellCommand(finalCommand!), {
          env: buildManagedProcessEnv(
            Bun.env as Record<string, string | undefined>,
            finalEnv,
          ),
          cwd: finalDirectory,
          stdout: Bun.file(stdoutPath),
          stderr: Bun.file(stderrPath),
        });

        newProcess.unref();
        return await resolveSpawnedProcessPid(
          newProcess.pid,
          finalCommand!,
          finalDirectory,
          name!,
        );
      },
    );

    if (
      actualPid <= 0 ||
      !(await waitForStartupHealth(actualPid, finalCommand!))
    ) {
      throw new Error(
        formatStartupFailureMessage(name!, stdoutPath, stderrPath),
      );
    }

    await measureRequired(run.measure, `Register "${name}"`, () =>
      retryDatabaseOperation(() =>
        insertProcess({
          pid: actualPid,
          workdir: finalDirectory,
          command: finalCommand!,
          name: name!,
          env: stringifyEnvString(finalEnv),
          configPath: finalConfigPath || "",
          stdout_path: stdoutPath,
          stderr_path: stderrPath,
        }),
      ),
    );

    if (!isInternalProcessName(name!)) {
      await measureRequired(run.measure, `Sync guard "${name}"`, () =>
        syncProcessWatcher(name!, finalEnv),
      );
    }

    announce(
      `${existingProcess ? "🔄 Restarted" : "🚀 Launched"} process "${name}" with PID ${actualPid}`,
      "Process Started",
    );
  } finally {
    releaseOperationLock();
  }
}
