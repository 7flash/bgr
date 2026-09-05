import { describe, expect, test } from "bun:test";
import { measureRequired } from "./observability";

const fakeMeasure = (async (_label: any, operation: () => Promise<any>) => {
  try {
    return await operation();
  } catch {
    return null;
  }
}) as any;

describe("measureRequired", () => {
  test("returns successful values", async () => {
    await expect(
      measureRequired(fakeMeasure, "successful phase", async () => 42),
    ).resolves.toBe(42);
  });

  test("preserves the original failure", async () => {
    const failure = new Error("boom");
    await expect(
      measureRequired(fakeMeasure, "failing phase", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  test("preserves undefined success values", async () => {
    await expect(
      measureRequired(fakeMeasure, "void phase", async () => undefined),
    ).resolves.toBeUndefined();
  });
});
