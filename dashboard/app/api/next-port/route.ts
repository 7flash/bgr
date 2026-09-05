/**
 * GET /api/next-port — Find the next available TCP port.
 */
import { getCurrentProcesses, parseCommandEnv } from "../../../lib/runtime";

const DEFAULT_BASE_PORT = 3001;
const MIN_PORT = 1;
const MAX_PORT = 65535;

function parseBasePort(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return DEFAULT_BASE_PORT;
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < MIN_PORT || value > MAX_PORT) {
    return null;
  }
  return value;
}

function addPort(set: Set<number>, value: unknown) {
  const port = Number(value);
  if (Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT) {
    set.add(port);
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = parseBasePort(url.searchParams.get("base"));
  if (base == null) {
    return Response.json(
      { error: "base must be an integer between 1 and 65535" },
      { status: 400 },
    );
  }

  const usedPorts = new Set<number>();
  for (const proc of getCurrentProcesses()) {
    const envStr = proc.env || "";
    const storedPortMatch = envStr.match(/(?:^|,)(?:PORT|BUN_PORT)=(\d+)/);
    if (storedPortMatch) addPort(usedPorts, storedPortMatch[1]);

    const commandEnv = parseCommandEnv(proc.command || "");
    addPort(usedPorts, commandEnv.PORT || commandEnv.BUN_PORT || "");
  }

  for (let port = base; port <= MAX_PORT; port++) {
    if (usedPorts.has(port)) continue;
    if (!(await isPortInUse(port))) {
      return Response.json({
        port,
        usedPorts: Array.from(usedPorts).sort((a, b) => a - b),
      });
    }
  }

  return Response.json(
    { error: `No available port between ${base} and ${MAX_PORT}` },
    { status: 503 },
  );
}

async function isPortInUse(port: number): Promise<boolean> {
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT)
    return true;
  try {
    const server = Bun.serve({
      port,
      hostname: "127.0.0.1",
      fetch() {
        return new Response("");
      },
    });
    server.stop(true);
    return false;
  } catch {
    return true;
  }
}
