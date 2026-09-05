/**
 * GET  /api/config/:name — Read configured process TOML content
 * PUT  /api/config/:name — Write configured process TOML content
 *
 * Dashboard editing is intentionally restricted to files inside the process
 * working directory. CLI configs may live elsewhere, but the web editor must
 * not become an arbitrary filesystem write primitive.
 */
import { getProcess } from "../../../../lib/runtime";
import { isAbsolute, relative, resolve } from "path";
import { readFile, writeFile } from "fs/promises";

type ConfigResolution =
  | { path: string; error: null }
  | { path: null; error: "missing" | "outside-workdir" };

function resolveConfigPath(proc: any): ConfigResolution {
  if (!proc?.configPath) return { path: null, error: "missing" };

  const workdir = resolve(String(proc.workdir || "."));
  const configPath = resolve(workdir, String(proc.configPath));
  const rel = relative(workdir, configPath);

  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    return { path: configPath, error: null };
  }

  return { path: null, error: "outside-workdir" };
}

function configPathError(result: ConfigResolution) {
  if (result.error === "outside-workdir") {
    return Response.json(
      {
        error:
          "Dashboard config editing is restricted to the process working directory",
      },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: { name: string } },
) {
  const name = decodeURIComponent(params.name);
  const proc = getProcess(name);

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const resolved = resolveConfigPath(proc);
  const pathError = configPathError(resolved);
  if (pathError) return pathError;
  if (!resolved.path) {
    return Response.json({ content: "", path: null, exists: false });
  }

  try {
    const content = await readFile(resolved.path, "utf-8");
    return Response.json({ content, path: resolved.path, exists: true });
  } catch {
    return Response.json({ content: "", path: resolved.path, exists: false });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { name: string } },
) {
  const name = decodeURIComponent(params.name);
  const proc = getProcess(name);

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const resolved = resolveConfigPath(proc);
  const pathError = configPathError(resolved);
  if (pathError) return pathError;
  if (!resolved.path) {
    return Response.json(
      { error: "No config path configured" },
      { status: 400 },
    );
  }

  try {
    const body = await req.json();
    if (typeof body?.content !== "string") {
      return Response.json(
        { error: "content must be a string" },
        { status: 400 },
      );
    }
    await writeFile(resolved.path, body.content, "utf-8");
    return Response.json({ success: true, path: resolved.path });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
