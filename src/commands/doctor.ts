import { existsSync, statSync } from "fs";
import { bgrHome, dbPath, getAllProcesses, getDbInfo } from "../db";
import { getVersion } from "../utils";

type DoctorOptions = {
  json?: boolean;
};

function safeStat(path: string) {
  try {
    if (!existsSync(path)) {
      return { exists: false };
    }

    const stat = statSync(path);
    return {
      exists: true,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getDuplicateNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();
}

export function getDoctorInfo() {
  const rows = getAllProcesses();
  const names = rows.map((row) => row.name).sort();

  return {
    version: getVersion(),
    runtime: `bun ${Bun.version}`,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    cwd: process.cwd(),
    execPath: process.execPath,
    argv0: process.argv0,
    home: process.env.HOME ?? process.env.USERPROFILE ?? null,
    bgrHome,
    dbPath,
    db: {
      ...safeStat(dbPath),
      info: getDbInfo(),
    },
    env: {
      BGRUN_DB: process.env.BGRUN_DB ?? null,
      BGR_HOME: process.env.BGR_HOME ?? null,
      BGR_PROCESS_NAME: process.env.BGR_PROCESS_NAME ?? null,
      BGR_PARENT_NAME: process.env.BGR_PARENT_NAME ?? null,
    },
    processes: {
      count: rows.length,
      uniqueNames: new Set(names).size,
      duplicateNames: getDuplicateNames(names),
      names,
    },
  };
}

export function handleDoctor(opts: DoctorOptions = {}) {
  const info = getDoctorInfo();

  if (opts.json) {
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  console.log("");
  console.log("bgrun doctor");
  console.log("════════════");
  console.log(`Version:       ${info.version}`);
  console.log(`Runtime:       ${info.runtime}`);
  console.log(`Platform:      ${info.platform} ${info.arch}`);
  console.log(`PID:           ${info.pid}`);
  console.log(`CWD:           ${info.cwd}`);
  console.log(`Exec Path:     ${info.execPath}`);
  console.log(`Home:          ${info.home ?? "(unknown)"}`);
  console.log("");
  console.log("Storage");
  console.log("───────");
  console.log(`BGR Home:      ${info.bgrHome}`);
  console.log(`DB Path:       ${info.dbPath}`);
  console.log(
    `BGRUN_DB:      ${info.env.BGRUN_DB ?? "(default bgrun.sqlite)"}`,
  );
  console.log(`DB Exists:     ${info.db.exists ? "yes" : "no"}`);
  if ("sizeBytes" in info.db)
    console.log(`DB Size:       ${info.db.sizeBytes} bytes`);
  if ("modifiedAt" in info.db)
    console.log(`DB Modified:   ${info.db.modifiedAt}`);
  console.log("");
  console.log("Processes");
  console.log("─────────");
  console.log(`Rows:          ${info.processes.count}`);
  console.log(`Unique Names:  ${info.processes.uniqueNames}`);
  console.log(
    `Duplicates:    ${
      info.processes.duplicateNames.length
        ? info.processes.duplicateNames.join(", ")
        : "none"
    }`,
  );
  console.log("");
  console.log("Names");
  console.log("─────");
  for (const name of info.processes.names) {
    console.log(`- ${name}`);
  }
  console.log("");
}
