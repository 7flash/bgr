import { $ } from "bun";
import { join } from "path";
import { watch } from "fs/promises";
import { readFileSync } from "fs";

// Get the current working directory of where the script is executed
const repoDirectory = (await $`git rev-parse --show-toplevel`.text()).trim();
const logDirectory = join(repoDirectory, 'logs');

// Retrieve the command from package.json
const packageJson = JSON.parse(readFileSync(join(repoDirectory, 'package.json'), 'utf-8'));
const command = packageJson.scripts?.refresh_cmd || "echo 777";

function getFormattedTime(): string {
  const now = new Date();
  const pad = (num: number) => num.toString().padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1); // months are 0-based
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

async function reloadThenExecuteAndCommitLogs() {
  let firstRun = true;

  while (true) {
    try {
      await $`git fetch`;

      const localHash = await $`git rev-parse @`.text();
      const remoteHash = await $`git rev-parse @{u}`.text();
      const hasRemoteUpdate = localHash.trim() !== remoteHash.trim();

      if (hasRemoteUpdate || firstRun) {
        firstRun = false;
        await $`git pull`;

        // Run the specified command
        const stdout = await $`${command}`.text();

        // Write logs to files
        const logFileName = `log_${getFormattedTime()}.txt`;
        const latestLogFilePath = join(logDirectory, "latest-logs.txt");
        const newLogFilePath = join(logDirectory, logFileName);

        await Bun.write(newLogFilePath, new Blob([stdout]));
        await Bun.write(latestLogFilePath, new Blob([stdout]));

        // Commit and push logs
        const branchName = "test-logs";
        const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();

        try {
          await $`git checkout -b ${branchName}`;
        } catch (err) {
          console.error("Branch creation failed, attempting to switch to existing branch...");
          await $`git checkout ${branchName}`;
        }

        await $`git add ${newLogFilePath} ${latestLogFilePath}`;
        await $`git commit -m "Update logs - ${getFormattedTime()}"`;
        await $`git push -u origin ${branchName}`;

        await $`git checkout ${currentBranch}`;
      }
    } catch (err) {
      console.error("Error during auto-refresh cycle:", err);
    }

    await Bun.sleep(5 * 1000); // Sleep for 5 seconds before the next cycle
  }
}

if (import.meta.path === Bun.main) {
  reloadThenExecuteAndCommitLogs();
}
```

This script now:

1. Retrieves the `refresh_cmd` script from `package.json`.
2. Executes the command directly.
3. Combines the functionality into a single `reloadThenExecuteAndCommitLogs` function.
4. Simplifies the logic while keeping the necessary error handling and logging.

Make sure your `package.json` includes a `refresh_cmd` script, like so:

```json
{
  "scripts": {
    "refresh_cmd": "your-command-here"
  }
}
```
