import { $, sleep } from "bun";
import { join } from "path";
import { file } from "bun";

// Get the current working directory of where the script is executed
const repoDirectory = (await $`git rev-parse --show-toplevel`.text()).trim();
const logDirectory = join(repoDirectory, 'bgr-output');

// Get the remote name from environment variable or use default
const remoteName = process.env.GIT_REMOTE_NAME || "7flash";
console.log(`🔗 Using git remote: ${remoteName}`);

// Read package.json to get the refresh command
const packageJsonPath = join(repoDirectory, 'package.json');
const packageJsonBlob = file(packageJsonPath);

let packageJson: any;

try {
  console.log(`📄 Reading package.json from ${packageJsonPath}...`);
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

  while (true) {
    try {
      console.log("🔄 Fetching latest changes...");
      await $`git fetch ${remoteName}`;

      const localHash = (await $`git rev-parse @`.text()).trim();
      const remoteHash = (await $`git rev-parse ${remoteName}/$(git rev-parse --abbrev-ref HEAD)`.text()).trim();

      console.log(`🔍 Local hash: ${localHash}`);
      console.log(`🔍 Remote hash: ${remoteHash}`);

      if (localHash !== remoteHash || firstRun) {
        firstRun = false;
        console.log("⬇️ Pulling latest changes...");
        await $`git pull ${remoteName} $(git rev-parse --abbrev-ref HEAD)`;

        console.log(`🚀 Executing command: ${command}`);
        let stdout = await $`${{ raw: command }} 2>&1`.nothrow().text();
        console.log(`📜 Command output: ${stdout}`);

        const logFileName = `log_${getFormattedTime().replace(/[: ]/g, '_')}.txt`;
        const latestLogFilePath = join(logDirectory, "latest.txt");
        const newLogFilePath = join(logDirectory, logFileName);

        const branchName = "bgr";
        const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();

        console.log(`🌿 Current branch: ${currentBranch}`);

        // Get the last commit message and trim to its first line
        const lastCommitMessage = (await $`git log -1 --pretty=%B`.text()).trim().split('\n')[0];
        const commitMessage = `bgr - ${lastCommitMessage}`;

        console.log(`📝 Commit message: ${commitMessage}`);

        try {
          console.log(`🌿 Creating and switching to branch: ${branchName}`);
          await $`git checkout -b ${branchName}`;
        } catch (err) {
          console.error("⚠️ Branch creation failed, attempting to switch to existing branch...");
          await $`git checkout ${branchName}`;
        }

        try {
          console.log(`💾 Writing log to ${newLogFilePath} and ${latestLogFilePath}`);
          await Bun.write(newLogFilePath, new Blob([stdout]));
          await Bun.write(latestLogFilePath, new Blob([stdout]));

          console.log("➕ Adding log files to git...");
          await $`git add ${newLogFilePath} ${latestLogFilePath}`;
          await $`git commit -m "${commitMessage} - ${getFormattedTime()}"`;
          console.log("🔼 Pushing changes to remote...");
          await $`git push -u ${remoteName} ${branchName}`;
        } catch (err) {
          console.error("❌ Error during git operations:", err);
        } finally {
          console.log(`🔄 Switching back to original branch: ${currentBranch}`);
          await $`git checkout ${currentBranch}`;
        }
      } else {
        console.log("🔍 No changes detected.");
      }

      // Update the terminal line with the date of the last update and hash
      process.stdout.write(`⏳ Last checked at ${getFormattedTime()} | Local: ${localHash} | Remote: ${remoteHash}\r`);
    } catch (err) {
      console.error("❌ Error during reload and execute cycle:", err);
    }

    await sleep(5 * 1000);
  }
}

if (import.meta.path === Bun.main) {
  console.log("🚀 Starting the reload and execute cycle...");
  reloadThenExecuteAndCommitLogs();
}
