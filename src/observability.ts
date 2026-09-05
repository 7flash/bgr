import { createMeasure } from "measure-fn";

/**
 * Shared observability scopes.
 *
 * Keep scope names stable: they become the trace prefixes developers see in
 * logs, so changing them is effectively an observability API change.
 */
export const runMeasure = createMeasure("run");
export const platformMeasure = createMeasure("platform");
export const watcherMeasure = createMeasure("watcher");
export const serverMeasure = createMeasure("server");
export const dbMeasure = createMeasure("db");
export const resourceMeasure = createMeasure("resources");

export type MeasureScope = ReturnType<typeof createMeasure>;
export type MeasureFunction = MeasureScope["measure"];
export type MeasureLabel = string;
export type ChildMeasure = <T>(
  label: MeasureLabel,
  operation: () => Promise<T> | T,
) => Promise<T | null>;

/**
 * measure-fn deliberately turns thrown errors into `null`. That is ideal for
 * best-effort telemetry, but lifecycle operations often need fail-fast
 * semantics. This adapter keeps measure-fn's trace/timing output while
 * preserving the original exception for callers.
 */
export async function measureRequired<T>(
  measure: MeasureFunction,
  label: MeasureLabel,
  operation: (childMeasure: ChildMeasure) => Promise<T> | T,
): Promise<T> {
  let failure: unknown;

  const result = (await measure(label, async (childMeasure: ChildMeasure) => {
    try {
      return { value: await operation(childMeasure) };
    } catch (error) {
      failure = error;
      throw error;
    }
  })) as { value: T } | null;

  if (result) return result.value;
  if (failure instanceof Error) throw failure;
  if (failure !== undefined) throw new Error(String(failure));

  throw new Error(`${label} failed`);
}
