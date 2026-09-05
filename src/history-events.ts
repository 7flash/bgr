import type { History } from "./db";

export type GuardRestartReason = "crash" | "memory";

export type GuardRestartMetadata = {
  by?: string;
  count?: number;
  backoffMs?: number;
  reason?: GuardRestartReason;
  memoryBytes?: number;
  memoryLimitMb?: number;
  error?: string;
};

export type GuardEvent = {
  time: number;
  name: string;
  action: "restart";
  success: boolean;
  reason?: GuardRestartReason;
  memoryBytes?: number;
  memoryLimitMb?: number;
  backoffMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asReason(value: unknown): GuardRestartReason | undefined {
  return value === "crash" || value === "memory" ? value : undefined;
}

export function parseGuardRestartMetadata(
  value: unknown,
): GuardRestartMetadata {
  if (typeof value !== "string" || !value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return {};

    return {
      by: typeof parsed.by === "string" ? parsed.by : undefined,
      count: asFiniteNumber(parsed.count),
      backoffMs: asFiniteNumber(parsed.backoffMs),
      reason: asReason(parsed.reason),
      memoryBytes: asFiniteNumber(parsed.memoryBytes),
      memoryLimitMb: asFiniteNumber(parsed.memoryLimitMb),
      error: typeof parsed.error === "string" ? parsed.error : undefined,
    };
  } catch {
    return {};
  }
}

export function historyRowToGuardEvent(
  row: Pick<History, "timestamp" | "process_name" | "event" | "metadata">,
): GuardEvent {
  const metadata = parseGuardRestartMetadata(row.metadata);

  return {
    time: new Date(row.timestamp).getTime(),
    name: row.process_name,
    action: "restart",
    success: row.event === "guard_restart",
    reason: metadata.reason,
    memoryBytes: metadata.memoryBytes,
    memoryLimitMb: metadata.memoryLimitMb,
    backoffMs: metadata.backoffMs,
  };
}
