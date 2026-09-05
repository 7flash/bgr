import { describe, expect, test } from "bun:test";
import { getErrorCode, getErrorMessage, hasErrorCode } from "./error-utils";

describe("error-utils", () => {
  test("preserves Error messages", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  test("accepts error-like objects without any casts at call sites", () => {
    expect(getErrorMessage({ message: "sqlite busy" })).toBe("sqlite busy");
    expect(getErrorCode({ code: "SQLITE_BUSY" })).toBe("SQLITE_BUSY");
    expect(hasErrorCode({ code: "SQLITE_BUSY" }, "SQLITE_BUSY")).toBe(true);
  });

  test("uses a stable fallback for unhelpful values", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage({}, "fallback")).toBe("fallback");
  });
});
