import { $ } from "bun";
import { join } from "path";

const logDirectory = join(process.env.HOME || '~', 'logs');
const command = process.env.REFRESH_CMD || "echo 777";

function getFormattedTime() {
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

async function checkForRemoteUpdate() {
  const localHash = await $`git rev-parse @`.text();
  const remoteHash = await $`git rev-parse @{u}`.text();
  return localHash.trim() !== remoteHash.trim();
}

async function runCommandAndLogOutput(command: string) {
  const logFileName = `log_${getFormattedTime()}.txt`;
  const latestLogFilePath = join(logDirectory, "latest-logs.txt");
  const newLogFilePath = join(logDirectory, logFileName);

  const stdout = await $`echo 123`.text();
  await Bun.write(newLogFilePath, new Blob([stdout]));
  await Bun.write(latestLogFilePath, new Blob([stdout]));

  return { newLogFilePath, latestLogFilePath };
}

async function commitAndPushLogs(newLogFilePath: string) {
  const branchName = "test-logs";
  const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();

  // Ensure the branch exists and is properly checked out
  try {
    await $`git checkout -b ${branchName}`;
  } catch (err) {
    console.error("Branch creation failed, attempting to switch to existing branch...");
    await $`git checkout ${branchName}`;
  }

  await $`git add ${newLogFilePath} ${logDirectory}/latest-logs.txt`;
  await $`git commit -m "Update logs - ${getFormattedTime()}"`;
  await $`git push -u origin ${branchName}`;

  await $`git checkout ${currentBranch}`;
}

let firstRun = true;

async function autoRefresh() {
  while (true) {
    try {
      await $`git fetch`;

      if (await checkForRemoteUpdate() || firstRun) {
        firstRun = false;
        await $`git pull`;
        await $`npm version patch`;

        const { newLogFilePath } = await runCommandAndLogOutput(command);

        await commitAndPushLogs(newLogFilePath);
      }
    } catch (err) {
      console.error("Error during auto-refresh cycle:", err);
    }

    await Bun.sleep(5 * 1000);
  }
}

if (import.meta.path === Bun.main) {
  autoRefresh();
}

