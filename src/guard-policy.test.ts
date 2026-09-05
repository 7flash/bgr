import { describe, expect, test } from "bun:test";
import {
  GUARD_MAX_BACKOFF_MS,
  getGuardBackoffMs,
  parseMemoryLimitMb,
} from "./guard-policy";

describe("parseMemoryLimitMb", () => {
  test("prefers explicit MB", () => {
    expect(
      parseMemoryLimitMb({
        BGR_MEMORY_LIMIT_MB: "384",
        BGR_MEMORY_LIMIT: "1g",
      }),
    ).toBe(384);
  });

  test("supports legacy units", () => {
    expect(parseMemoryLimitMb({ BGR_MEMORY_LIMIT: "512m" })).toBe(512);
    expect(parseMemoryLimitMb({ BGR_MEMORY_LIMIT: "1.5g" })).toBe(1536);
    expect(parseMemoryLimitMb({ BGR_MEMORY_LIMIT: "1024k" })).toBe(1);
  });

  test("rejects invalid limits", () => {
    expect(parseMemoryLimitMb({ BGR_MEMORY_LIMIT: "nope" })).toBe(0);
    expect(parseMemoryLimitMb({ BGR_MEMORY_LIMIT_MB: "-1" })).toBe(0);
  });
});

describe("getGuardBackoffMs", () => {
  test("allows the initial restart window", () => {
    expect(getGuardBackoffMs(1)).toBe(0);
    expect(getGuardBackoffMs(5)).toBe(0);
  });

  test("backs off exponentially and caps", () => {
    expect(getGuardBackoffMs(6)).toBe(30_000);
    expect(getGuardBackoffMs(7)).toBe(60_000);
    expect(getGuardBackoffMs(100)).toBe(GUARD_MAX_BACKOFF_MS);
  });
});
