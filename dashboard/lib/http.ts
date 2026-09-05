import { getErrorMessage } from "../../dist/api.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonObject(req: Request): Promise<JsonObject> {
  let value: unknown;
  try {
    value = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }

  if (!isJsonObject(value)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return value;
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function readRequiredString(value: unknown, field: string): string {
  const text = readOptionalString(value)?.trim() ?? "";
  if (!text) throw new HttpError(400, `${field} is required`);
  return text;
}

export function readStringRecord(
  value: unknown,
  field = "value",
): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isJsonObject(value)) {
    throw new HttpError(400, `${field} must be an object of string values`);
  }

  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") {
      throw new HttpError(400, `${field}.${key} must be a string`);
    }
    result[key] = item;
  }
  return result;
}

export function jsonError(error: unknown, fallbackStatus = 500): Response {
  const status = error instanceof HttpError ? error.status : fallbackStatus;
  return Response.json({ error: getErrorMessage(error) }, { status });
}
