import { describe, expect, test } from "bun:test";
import { sortResourceRows, type ResourceSnapshotRow } from "./resource-monitor";
import { formatTopRow } from "./commands/top";

const base = (
  name: string,
  cpu: number,
  memory: number,
): ResourceSnapshotRow => ({
  name,
  pid: 100,
  cpu,
  memory,
  ports: [],
  running: true,
  guarded: false,
  memoryLimitMb: 0,
  managed: true,
  command: "bun run server.ts",
});

describe("resource monitor policy", () => {
  test("sorts memory descending by default", () => {
    const rows = [base("small", 9, 10), base("large", 1, 30)];
    expect(sortResourceRows(rows).map((row) => row.name)).toEqual([
      "large",
      "small",
    ]);
  });

  test("sorts cpu descending", () => {
    const rows = [base("slow", 1, 30), base("busy", 20, 10)];
    expect(sortResourceRows(rows, "cpu").map((row) => row.name)).toEqual([
      "busy",
      "slow",
    ]);
  });

  test("formats guard memory limit", () => {
    const row = {
      ...base("api", 2.4, 256 * 1024 * 1024),
      guarded: true,
      memoryLimitMb: 400,
      ports: [3000],
    };
    expect(formatTopRow(row)).toContain("guard=on/400MB");
    expect(formatTopRow(row)).toContain("ports=3000");
  });
});
