/** GET /api/version — return the installed bgrun version. */
import { getVersion } from "../../../lib/runtime";
import { apiMeasure as api, measureRequired } from "../../../lib/observability";

export async function GET() {
  try {
    const version = await measureRequired(
      api.measure,
      "Get version",
      getVersion,
    );
    return Response.json({ version });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
