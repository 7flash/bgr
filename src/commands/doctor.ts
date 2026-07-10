import { getAllProcesses } from "../db";
import { getBgrunMeta } from "./meta";

export type DoctorOptions = {
  json?: boolean;
};

export function getDoctorInfo() {
  const meta = getBgrunMeta();
  const rows = getAllProcesses();
  const names = rows.map((row) => row.name).sort();

  return {
    ...meta,
    processes: {
      ...meta.processes,
      names,
    },
  };
}

export function handleDoctor(options: DoctorOptions = {}) {
  const info = getDoctorInfo();

  if (options.json) {
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
  console.log("Registry");
  console.log("────────");
  console.log(`Rows:          ${info.processes.count}`);
  console.log(`Unique Names:  ${info.processes.uniqueNames}`);
  console.log(
    `Duplicates:    ${info.processes.duplicateNames.length ? info.processes.duplicateNames.join(", ") : "none"}`,
  );
  console.log("");
  console.log("Names");
  console.log("─────");
  if (info.processes.names.length === 0) {
    console.log("(none)");
  } else {
    for (const name of info.processes.names) console.log(`- ${name}`);
  }
  console.log("");
}
