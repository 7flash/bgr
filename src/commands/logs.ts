import { getProcess } from "../db";
import { error } from "../logger";
import { readFileTail } from "../platform";
import chalk from "chalk";
import * as fs from "fs";

export async function showLogs(
  name: string,
  logType: "stdout" | "stderr" | "both" = "both",
  lines?: number,
) {
  const proc = getProcess(name);
  if (!proc) {
    error(`No process found named '${name}'`);
    return; // TS shut up
  }

  if (logType === "both" || logType === "stdout") {
    console.log(chalk.green.bold(`📄 Stdout logs for ${name}:`));
    console.log(chalk.gray("═".repeat(50)));

    if (fs.existsSync(proc.stdout_path)) {
      try {
        const output = await readFileTail(proc.stdout_path, lines);
        console.log(output || chalk.gray("(no output)"));
      } catch (err) {
        console.log(chalk.red(`Error reading stdout: ${err}`));
      }
    } else {
      console.log(chalk.gray("(log file not found)"));
    }

    if (logType === "both") {
      console.log("\n");
    }
  }

  if (logType === "both" || logType === "stderr") {
    console.log(chalk.red.bold(`📄 Stderr logs for ${name}:`));
    console.log(chalk.gray("═".repeat(50)));

    if (fs.existsSync(proc.stderr_path)) {
      try {
        const output = await readFileTail(proc.stderr_path, lines);
        console.log(output || chalk.gray("(no errors)"));
      } catch (err) {
        console.log(chalk.red(`Error reading stderr: ${err}`));
      }
    } else {
      console.log(chalk.gray("(log file not found)"));
    }
  }
}
