import { $, sleep, write, file } from "bun";
import { join } from "path";
import { watch } from "fs/promises";


// Get the current working directory of where the script is executed
const repoDirectory = (await $`git rev-parse --show-toplevel`.text()).trim();
const logDirectory = join(repoDirectory, 'bgr-output');

// Get the remote name from environment variable or use default
const remoteName = process.env.GIT_REMOTE_NAME || "7flash";
console.log(`Using git remote: ${remoteName}`);

// Read package.json to get the refresh command
const packageJsonPath = join(repoDirectory, 'package.json');
const packageJsonBlob = Bun.file(packageJsonPath);

let packageJson: any;

try {
  console.log(`📖 Reading package.json from ${packageJsonPath}...`);
  packageJson = JSON.parse(await packageJsonBlob.text());
  console.log("✅ Successfully parsed package.json.");
} catch (err) {
  console.error("❌ Error: Unable to parse package.json.");
  console.error("Please ensure your package.json is valid JSON. Example:");
  console.error(`
{
  "name": "your-project",
  "version": "1.0.0",
  "refresh_cmd": "your-command-here"
}
  `);
  process.exit(1);
}

if (!packageJson.refresh_cmd) {
  console.error("❌ Error: 'refresh_cmd' is missing in package.json.");
  console.error("Please add 'refresh_cmd' to your package.json. Example:");
  console.error(`
{
  "name": "your-project",
  "version": "1.0.0",
  "refresh_cmd": "your-command-here"
}
  `);
  process.exit(1);
}

const command = packageJson.refresh_cmd;
console.log(`🔄 Refresh command: ${command}`);

function getFormattedTime(): string {
  const now = new Date();
  const pad = (num: number) => num.toString().padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1); // months are 0-based
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function reloadThenExecuteAndCommitLogs() {
  let firstRun = true;
  let lastUpdate = '';

  while (true) {
    try {
<<<<<<< HEAD
      console.log("🔍 Fetching latest changes...");
      await $`git fetch`;
=======
      console.log("Fetching latest changes...");
      await $`git fetch ${remoteName}`;
>>>>>>> oct11

      const localHash = (await $`git rev-parse @`.text()).trim();
      const remoteHash = (await $`git rev-parse ${remoteName}/$(git rev-parse --abbrev-ref HEAD)`.text()).trim();

      if (localHash !== remoteHash || firstRun) {
        firstRun = false;
<<<<<<< HEAD
        console.log("⬇️ Pulling latest changes...");
        await $`git pull`;

        console.log(`🚀 Executing command: ${command}`);
        let stdout = await $`${{ raw: command }} 2>&1`.text();
        console.log(`💬 Command output: ${stdout}`);

        const logFileName = `log_${getFormattedTime().replace(/[: ]/g, '_')}.txt`;
        const latestLogFilePath = join(logDirectory, "latest-logs.txt");
=======
        console.log("Pulling latest changes...");
        await $`git pull ${remoteName} $(git rev-parse --abbrev-ref HEAD)`;

        console.log(`Executing command: ${command}`);
        let stdout = await $`${{ raw: command }} 2>&1`.nothrow().text();
        console.log(`Command output: ${stdout}`);

        const logFileName = `log_${getFormattedTime()}.txt`;
        const latestLogFilePath = join(logDirectory, "latest.txt");
>>>>>>> oct11
        const newLogFilePath = join(logDirectory, logFileName);

        const branchName = "bgr";
        const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();

        const lastCommitMessage = (await $`git log -1 --pretty=%B`.text()).trim().split('\n')[0];
        const commitMessage = `bgr - ${lastCommitMessage}`;

        try {
          console.log(`🌿 Creating and switching to branch: ${branchName}`);
          await $`git checkout -b ${branchName}`;
        } catch (err) {
          console.error("⚠️ Branch creation failed, attempting to switch to existing branch...");
          await $`git checkout ${branchName}`;
        }

<<<<<<< HEAD
        console.log(`📝 Writing log to ${newLogFilePath} and ${latestLogFilePath}`);
        await Bun.write(newLogFilePath, new Blob([stdout]));
        await Bun.write(latestLogFilePath, new Blob([stdout]));

        console.log("📂 Adding log files to git...");
        await $`git add ${newLogFilePath} ${latestLogFilePath}`;
        await $`git commit -m "${commitMessage} - ${getFormattedTime()}"`;
        console.log("📤 Pushing changes to remote...");
        await $`git push -u origin ${branchName}`;

        console.log(`🔙 Switching back to original branch: ${currentBranch}`);
        await $`git checkout ${currentBranch}`;

        lastUpdate = `Last update at ${getFormattedTime()} with hash ${localHash}`;
=======
        try {
          console.log(`Writing log to ${newLogFilePath} and ${latestLogFilePath}`);
          await Bun.write(newLogFilePath, new Blob([stdout]));
          await Bun.write(latestLogFilePath, new Blob([stdout]));

          console.log("Adding log files to git...");
          await $`git add ${newLogFilePath} ${latestLogFilePath}`;
          await $`git commit -m "${commitMessage} - ${getFormattedTime()}"`;
          console.log("Pushing changes to remote...");
          await $`git push -u ${remoteName} ${branchName}`;
        } catch (err) {
          console.error("Error during git operations:", err);
        } finally {
          console.log(`Switching back to original branch: ${currentBranch}`);
          await $`git checkout ${currentBranch}`;
        }
>>>>>>> oct11
      } else {
        // Update the terminal line with the last update information
        process.stdout.write(`\r⏱️ ${lastUpdate}`);
      }
    } catch (err) {
      console.error("❌ Error during reload and execute cycle:", err);
    }

<<<<<<< HEAD
    await new Promise(resolve => setTimeout(resolve, 1000)); // Avoid busy waiting
=======
    console.log("Sleeping for 5 seconds...");
    await sleep(5 * 1000);
>>>>>>> oct11
  }
}

if (import.meta.path === Bun.main) {
  console.log("🔄 Starting the reload and execute cycle...");
  reloadThenExecuteAndCommitLogs();
}

