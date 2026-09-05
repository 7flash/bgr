import { getProcessSnapshots } from "../../../lib/process-store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bustCache = url.searchParams.has("t");
  const port = Number.parseInt(url.searchParams.get("port") ?? "", 10);
  const hasPortFilter = Number.isInteger(port) && port > 0;

  try {
    let data = await getProcessSnapshots({
      fresh: bustCache || hasPortFilter,
    });

    if (hasPortFilter) {
      data = data.filter((process) => process.ports.includes(port));
    }

    return Response.json(data);
  } catch (error) {
    console.error("[api/processes] snapshot failed", error);
    return Response.json([], { status: 503 });
  }
}
