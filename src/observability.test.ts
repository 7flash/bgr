import { describe, expect, test } from "bun:test";
import {
  measureRequired,
  type ChildMeasure,
  type MeasureFunction,
} from "./observability";

const fakeChildMeasure: ChildMeasure = async (_label, operation) => {
  try {
    return await operation();
  } catch {
    return null;
  }
};

const fakeMeasure = (async (
  _label: string,
  operation: (childMeasure: ChildMeasure) => Promise<unknown> | unknown,
) => {
  try {
    return await operation(fakeChildMeasure);
  } catch {
    return null;
  }
}) as MeasureFunction;

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
