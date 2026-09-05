import { describe, expect, test } from "bun:test";
import {
  historyRowToGuardEvent,
  parseGuardRestartMetadata,
} from "./history-events";

describe("history-events", () => {
  test("parses known guard metadata and ignores invalid fields", () => {
    expect(
      parseGuardRestartMetadata(
        JSON.stringify({
          reason: "memory",
          memoryBytes: 123,
          memoryLimitMb: 100,
          backoffMs: 30_000,
          count: "bad",
        }),
      ),
    ).toEqual({
      by: undefined,
      count: undefined,
      backoffMs: 30_000,
      reason: "memory",
      memoryBytes: 123,
      memoryLimitMb: 100,
      error: undefined,
    });
  });

  test("turns malformed metadata into an empty object", () => {
    expect(parseGuardRestartMetadata("{nope")).toEqual({});
  });

  test("maps history rows into typed dashboard events", () => {
    const event = historyRowToGuardEvent({
      timestamp: "2026-09-05T00:00:00.000Z",
      process_name: "api",
      event: "guard_restart",
      metadata: JSON.stringify({ reason: "crash", backoffMs: 1000 }),
    });

    expect(event.name).toBe("api");
    expect(event.success).toBe(true);
    expect(event.reason).toBe("crash");
    expect(event.backoffMs).toBe(1000);
  });
});
