import bgrun from "bgrun";

// CLI: bgrun --name my-api --command "bun run server.ts" --directory ./api
await bgrun.handleRun({
  name: "my-api",
  command: "bun run server.ts",
  directory: "./api",
});

// CLI: bgrun (lists all)
for (const p of bgrun.getAllProcesses()) {
  const alive = await bgrun.isProcessRunning(p.pid);
  const ports = await bgrun.getProcessPorts(p.pid);
  console.log(`${p.name}: ${alive ? "●" : "○"} ${ports}`);
}

// CLI: bgrun my-api --logs
console.log(
  await bgrun.readFileTail(bgrun.getProcess("my-api")!.stdout_path, 20),
);

// CLI: bgrun --dashboard
