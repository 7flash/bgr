import { getProcess } from "../db";
import { error } from "../logger";
import { readFileTail } from "../platform";
import chalk from "chalk";
import * as fs from "fs";

export type LogType = "stdout" | "stderr" | "both";

export type ShowLogsOptions = {
  /** Keep streaming appended log output until Ctrl+C/SIGTERM. */
  follow?: boolean;
  /** Poll interval for follow mode. Defaults to 250ms. */
  pollMs?: number;
};

type FollowTarget = {
  path: string;
  label: string;
  color: (value: string) => string;
  prefix: boolean;
};

function outputHeader(
  label: string,
  _name: string,
  color: (value: string) => string,
) {
  console.log(color(`[${label.toLowerCase()}]`));
}

function fileSize(path: string): number {
  try {
    return fs.existsSync(path) ? fs.statSync(path).size : 0;
  } catch {
    return 0;
  }
}

function readRange(path: string, start: number, end: number): string {
  const length = Math.max(0, end - start);
  if (length <= 0) return "";

  const fd = fs.openSync(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, start);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function writeFollowChunk(target: FollowTarget, chunk: string) {
  if (!chunk) return;

  // Prefix each complete line when following both stdout and stderr so the
  // interleaved stream stays readable. Preserve partial text best-effort.
  if (!target.prefix) {
    process.stdout.write(chunk);
    if (!chunk.endsWith("\n")) process.stdout.write("\n");
    return;
  }

  for (const line of chunk.split(/\r?\n/g)) {
    if (!line) continue;
    process.stdout.write(
      target.color(`[${target.label.toLowerCase()}] ${line}\n`),
    );
  }
}

function startFollowing(target: FollowTarget, pollMs: number): () => void {
  let offset = fileSize(target.path);
  let announcedWaiting = false;

  if (!fs.existsSync(target.path)) {
    console.log(
      chalk.gray(
        `[${target.label.toLowerCase()}] waiting for log file: ${target.path}`,
      ),
    );
    announcedWaiting = true;
  }

  const timer = setInterval(() => {
    try {
      if (!fs.existsSync(target.path)) {
        if (!announcedWaiting) {
          console.log(
            chalk.gray(
              `[${target.label.toLowerCase()}] waiting for log file: ${target.path}`,
            ),
          );
          announcedWaiting = true;
        }
        return;
      }

      const size = fs.statSync(target.path).size;

      // File was truncated or rotated. Start reading from the beginning again.
      if (size < offset) offset = 0;
      if (size === offset) return;

      const chunk = readRange(target.path, offset, size);
      offset = size;
      writeFollowChunk(target, chunk);
    } catch (err) {
      console.log(
        chalk.red(`[${target.label.toLowerCase()}] follow error: ${err}`),
      );
    }
  }, pollMs);

  return () => clearInterval(timer);
}

async function printInitialLog(
  path: string,
  emptyMessage: string,
  lines: number | undefined,
) {
  if (!fs.existsSync(path)) {
    console.log(chalk.gray("(log file not found)"));
    return;
  }

  try {
    const output = await readFileTail(path, lines);
    console.log(output || chalk.gray(emptyMessage));
  } catch (err) {
    console.log(chalk.red(`Error reading log: ${err}`));
  }
}

export async function showLogs(
  name: string,
  logType: LogType = "both",
  lines?: number,
  options: ShowLogsOptions = {},
) {
  const proc = getProcess(name);
  if (!proc) {
    error(`No process found named '${name}'`);
    return;
  }

  const follow = options.follow === true;
  const initialLines = follow && !lines ? 100 : lines;
  const targets: FollowTarget[] = [];

  if (logType === "both" || logType === "stdout") {
    outputHeader("Stdout", name, chalk.green.bold);
    await printInitialLog(proc.stdout_path, "(no output)", initialLines);

    if (follow) {
      targets.push({
        path: proc.stdout_path,
        label: "Stdout",
        color: chalk.green,
        prefix: logType === "both",
      });
    }

    if (logType === "both") console.log("");
  }

  if (logType === "both" || logType === "stderr") {
    outputHeader("Stderr", name, chalk.red.bold);
    await printInitialLog(proc.stderr_path, "(no errors)", initialLines);

    if (follow) {
      targets.push({
        path: proc.stderr_path,
        label: "Stderr",
        color: chalk.red,
        prefix: logType === "both",
      });
    }
  }

  if (!follow) return;

  console.log(chalk.gray("following logs; Ctrl+C to stop"));

  const stopFns = targets.map((target) =>
    startFollowing(target, Math.max(50, options.pollMs ?? 250)),
  );

  await new Promise<void>((resolve) => {
    const stop = () => {
      for (const fn of stopFns) fn();
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
