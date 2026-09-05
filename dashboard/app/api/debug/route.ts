/** GET /api/debug — diagnostic information about the current bgrun runtime. */
import { getDbInfo } from "../../../lib/runtime";
import { apiMeasure as api } from "../../../lib/observability";

export async function GET() {
  const info = (await api.measure("DB info", () => getDbInfo())) ?? {
    dbPath: null,
    bgrHome: null,
    dbFilename: null,
    exists: false,
  };

  return Response.json({
    ...info,
    platform: process.platform,
    bun: Bun.version,
    pid: process.pid,
    cwd: process.cwd(),
  });
}
