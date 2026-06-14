import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { findUnrecognizedKeys, warnUnrecognizedKeys } from "./schema-warnings";

const schema = z.object({ name: z.string(), max_steps: z.number().optional() });

describe("findUnrecognizedKeys", () => {
  test("returns an empty array when all keys are recognized", () => {
    expect(findUnrecognizedKeys(schema, { name: "x", max_steps: 5 })).toEqual([]);
  });

  test("returns top-level keys not present in the schema", () => {
    expect(findUnrecognizedKeys(schema, { name: "x", step_timeout_ms: 1000, foo: "bar" })).toEqual([
      "step_timeout_ms",
      "foo",
    ]);
  });

  test("returns an empty array for non-object input", () => {
    expect(findUnrecognizedKeys(schema, "not an object")).toEqual([]);
    expect(findUnrecognizedKeys(schema, null)).toEqual([]);
    expect(findUnrecognizedKeys(schema, ["a", "b"])).toEqual([]);
  });
});

describe("warnUnrecognizedKeys", () => {
  let originalWarn: typeof console.warn;
  let calls: unknown[][];

  beforeEach(() => {
    originalWarn = console.warn;
    calls = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  test("does not warn when there are no unrecognized keys", () => {
    warnUnrecognizedKeys(schema, { name: "x" }, "agent config \"a.yaml\"");
    expect(calls).toHaveLength(0);
  });

  test("warns once, listing all unrecognized keys and the context", () => {
    warnUnrecognizedKeys(schema, { name: "x", step_timeout_ms: 1000, foo: "bar" }, "agent config \"a.yaml\"");
    expect(calls).toHaveLength(1);
    const [message] = calls[0] as [string];
    expect(message).toContain("agent config \"a.yaml\"");
    expect(message).toContain('"step_timeout_ms"');
    expect(message).toContain('"foo"');
  });
});
