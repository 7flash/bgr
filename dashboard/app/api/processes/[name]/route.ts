/** DELETE /api/processes/:name — stop and remove a process. */
import {
  getProcess,
  isProcessRunning,
  removeProcessByName,
  terminateProcess,
} from "../../../../lib/runtime";
import {
  apiMeasure as api,
  measureRequired,
} from "../../../../lib/observability";
import { jsonError } from "../../../../lib/http";

export async function DELETE(
  _req: Request,
  { params }: { params: { name: string } },
) {
  const name = decodeURIComponent(params.name);
  const proc = getProcess(name);
  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  try {
    if (await isProcessRunning(proc.pid, proc.command)) {
      await measureRequired(
        api.measure,
        `Stop process before delete "${name}" pid=${proc.pid}`,
        () => terminateProcess(proc.pid),
      );
    }

    removeProcessByName(name);
    return Response.json({ success: true });
  } catch (error: unknown) {
    return jsonError(error);
  }
}
