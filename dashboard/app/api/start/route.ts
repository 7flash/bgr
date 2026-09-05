/** POST /api/start — create or start a process. */
import { addHistoryEntry, handleRun } from "../../../lib/runtime";
import { apiMeasure as api, measureRequired } from "../../../lib/observability";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const env =
      body.env && typeof body.env === "object" && !Array.isArray(body.env)
        ? (body.env as Record<string, string>)
        : undefined;

    await measureRequired(api.measure, `Start process "${name}"`, () =>
      handleRun({
        action: "run",
        name,
        command: typeof body.command === "string" ? body.command : undefined,
        directory:
          typeof body.directory === "string" ? body.directory : undefined,
        force: body.force === true,
        env,
        remoteName: "",
      }),
    );

    addHistoryEntry(name, "start");
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
