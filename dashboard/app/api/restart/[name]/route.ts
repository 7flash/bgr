/** POST /api/restart/:name — force-restart a registered process. */
import {
  addHistoryEntry,
  getProcess,
  handleRun,
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
    await measureRequired(
      api.measure,
      `Restart process "${name}" pid=${proc.pid}`,
      () =>
        handleRun({
          action: "run",
          name,
          force: true,
          remoteName: "",
        }),
    );

    addHistoryEntry(name, "restart", proc.pid);
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
