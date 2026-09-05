/** GET /api/version — return the installed bgrun version. */
import { getVersion } from "../../../lib/runtime";
import { apiMeasure as api, measureRequired } from "../../../lib/observability";
import { jsonError } from "../../../lib/http";

export async function GET() {
  try {
    const version = await measureRequired(
      api.measure,
      "Get version",
      getVersion,
    );
    return Response.json({ version });
  } catch (error: unknown) {
    return jsonError(error);
  }
}
