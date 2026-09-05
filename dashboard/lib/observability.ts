import { createMeasure } from "measure-fn";

export const apiMeasure = createMeasure("api");

type MeasureFunction = ReturnType<typeof createMeasure>["measure"];
type MeasureLabel = string;

/** Preserve route failure semantics while still emitting measure-fn traces. */
export async function measureRequired<T>(
  measure: MeasureFunction,
  label: MeasureLabel,
  operation: (childMeasure: any) => Promise<T> | T,
): Promise<T> {
  let failure: unknown;
  const result = (await measure(label, async (childMeasure: any) => {
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
