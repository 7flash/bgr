import { describe, expect, test } from "bun:test";
import { dbPath, bgrHome } from "./db";
import { getDoctorInfo } from "./commands/doctor";
import { showAll } from "./commands/list";

describe("fast json and doctor", () => {
  test("doctor exposes db path", () => {
    const info = getDoctorInfo();
    expect(info.dbPath).toBe(dbPath);
    expect(info.bgrHome).toBe(bgrHome);
    expect(info.env).toHaveProperty("BGRUN_DB");
  });

  test("showAll supports fast json meta mode", async () => {
    const original = console.log;
    let output = "";
    console.log = (value?: unknown) => {
      output += String(value ?? "");
    };

    try {
      await showAll({ json: true, jsonMeta: true });
    } finally {
      console.log = original;
    }

    const parsed = JSON.parse(output);
    expect(parsed.meta.dbPath).toBe(dbPath);
    expect(Array.isArray(parsed.processes)).toBe(true);
  });
});
