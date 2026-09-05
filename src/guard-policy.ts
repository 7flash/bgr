export const DEFAULT_GUARD_INTERVAL_MS = 5_000;
export const GUARD_CRASH_THRESHOLD = 5;
export const GUARD_MAX_BACKOFF_MS = 5 * 60_000;
export const GUARD_STABILITY_WINDOW_MS = 120_000;
export const MEMORY_LIMIT_HITS_REQUIRED = 3;

/** Parse BGR_MEMORY_LIMIT_MB or the legacy BGR_MEMORY_LIMIT=500m form to MiB. */
export function parseMemoryLimitMb(env: Record<string, string>): number {
  const explicitMb = Number(env.BGR_MEMORY_LIMIT_MB || 0);
  if (Number.isFinite(explicitMb) && explicitMb > 0) return explicitMb;

  const raw = String(env.BGR_MEMORY_LIMIT || "")
    .trim()
    .toLowerCase();
  if (!raw) return 0;

  const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmgt]?)(?:i?b)?$/i);
  if (!match) return 0;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;

  switch (match[2].toLowerCase()) {
    case "k":
      return value / 1024;
    case "g":
      return value * 1024;
    case "t":
      return value * 1024 * 1024;
    default:
      return value;
  }
}

export function getGuardBackoffMs(restartCount: number): number {
  if (restartCount <= GUARD_CRASH_THRESHOLD) return 0;
  const exponent = restartCount - GUARD_CRASH_THRESHOLD;
  return Math.min(30_000 * 2 ** (exponent - 1), GUARD_MAX_BACKOFF_MS);
}
