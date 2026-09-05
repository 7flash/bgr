export type ErrorCodeCarrier = {
  code?: unknown;
};

export type ErrorMessageCarrier = {
  message?: unknown;
};

export function getErrorMessage(
  error: unknown,
  fallback = "Unknown error",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as ErrorMessageCarrier).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (error === null || error === undefined) return fallback;

  try {
    const value = String(error);
    return value && value !== "[object Object]" ? value : fallback;
  } catch {
    return fallback;
  }
}

export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }

  const code = (error as ErrorCodeCarrier).code;
  if (typeof code === "string" && code.trim()) return code;
  if (typeof code === "number" && Number.isFinite(code)) return String(code);
  return undefined;
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return getErrorCode(error) === code;
}
