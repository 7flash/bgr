import { $ } from "bun";
import { join } from "path";
import { watch } from "fs/promises";

// Get the current working directory of where the script is executed
const repoDirectory = (await $`git rev-parse --show-toplevel`.text()).trim();
const logDirectory = join(repoDirectory, 'logs');

// Read package.json to get the refresh command
const packageJsonPath = join(repoDirectory, 'package.json');
const packageJsonBlob = Bun.file(packageJsonPath);
const packageJson = JSON.parse(await packageJsonBlob.text());
const command = packageJson.refresh_cmd;

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

      const localHash = (await $`git rev-parse @`.text()).trim();
      const remoteHash = (await $`git rev-parse @{u}`.text()).trim();

      if (localHash !== remoteHash || firstRun) {
        firstRun = false;
        await $`git pull`;

        // Execute the command directly
        const stdout = await $`${command}`.text();

        const logFileName = `log_${getFormattedTime()}.txt`;
        const latestLogFilePath = join(logDirectory, "latest-logs.txt");
        const newLogFilePath = join(logDirectory, logFileName);

        const branchName = "test-logs";
        const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
        const commitMessage = "Update logs";

        try {
          await $`git checkout -b ${branchName}`;
        } catch (err) {
          console.error("Branch creation failed, attempting to switch to existing branch...");
          await $`git checkout ${branchName}`;
        }

        await Bun.write(newLogFilePath, new Blob([stdout]));
        await Bun.write(latestLogFilePath, new Blob([stdout]));

        await $`git add ${newLogFilePath} ${latestLogFilePath}`;
        await $`git commit -m "${commitMessage} - ${getFormattedTime()}"`;
        await $`git push -u origin ${branchName}`;

        await $`git checkout ${currentBranch}`;
      }
    } catch (err) {
      console.error("Error during reload and execute cycle:", err);
    }

    await Bun.sleep(5 * 1000);
  }
}

if (import.meta.path === Bun.main) {
  reloadThenExecuteAndCommitLogs();
}
