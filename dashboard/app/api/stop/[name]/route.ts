/** POST /api/stop/:name — stop the registered PID only. */
import {
  addHistoryEntry,
  getProcess,
  isProcessRunning,
  terminateProcess,
  updateProcessPid,
} from "../../../../lib/runtime";
import {
  apiMeasure as api,
  measureRequired,
} from "../../../../lib/observability";

export async function POST(
  _req: Request,
  { params }: { params: { name: string } },
) {
  const name = decodeURIComponent(params.name);
  const proc = getProcess(name);
  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  try {
    const running = await isProcessRunning(proc.pid, proc.command);
    if (!running) {
      updateProcessPid(name, 0);
      return Response.json({ success: true, already_stopped: true });
    }

    await measureRequired(
      api.measure,
      `Stop process "${name}" pid=${proc.pid}`,
      () => terminateProcess(proc.pid),
    );

    updateProcessPid(name, 0);
    addHistoryEntry(name, "stop", proc.pid);
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
