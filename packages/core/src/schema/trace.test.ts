import { describe, expect, test } from "bun:test";
import { StepEventSchema, TraceSchema } from "./trace";

describe("StepEventSchema", () => {
  const minimal = {
    index: 0,
    kind: "message" as const,
    timestamp: 1_700_000_000_000,
  };

  test("accepts a minimal step event and defaults token/cost fields to 0", () => {
    const result = StepEventSchema.parse(minimal);
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.cachedTokens).toBe(0);
    expect(result.costUsd).toBe(0);
    expect(result.tool).toBeUndefined();
    expect(result.content).toBeUndefined();
  });

  test("rejects a step event missing required fields", () => {
    expect(() => StepEventSchema.parse({ ...minimal, index: undefined })).toThrow();
    expect(() => StepEventSchema.parse({ ...minimal, timestamp: undefined })).toThrow();
  });

  test.each(["tool_call", "tool_result", "message", "thinking"])("accepts kind %s", (kind) => {
    expect(() => StepEventSchema.parse({ ...minimal, kind })).not.toThrow();
  });

  test("rejects an invalid kind", () => {
    expect(() => StepEventSchema.parse({ ...minimal, kind: "log" })).toThrow();
  });

  test("accepts a tool_call step with tool name, tokens, cache, and cost", () => {
    const result = StepEventSchema.parse({
      ...minimal,
      kind: "tool_call",
      tool: "executeCommand",
      tokensIn: 1200,
      tokensOut: 50,
      cachedTokens: 900,
      costUsd: 0.0012,
      content: "show-diff mathutils.py",
    });
    expect(result.tool).toBe("executeCommand");
    expect(result.cachedTokens).toBe(900);
    expect(result.content).toBe("show-diff mathutils.py");
  });
});

describe("TraceSchema", () => {
  test("accepts a trace with multiple steps", () => {
    const result = TraceSchema.parse({
      runId: "run-1",
      steps: [
        { index: 0, kind: "message", timestamp: 1 },
        { index: 1, kind: "tool_call", tool: "readFile", timestamp: 2 },
      ],
    });
    expect(result.steps).toHaveLength(2);
  });

  test("accepts a trace with no steps", () => {
    const result = TraceSchema.parse({ runId: "run-1", steps: [] });
    expect(result.steps).toEqual([]);
  });

  test("rejects a trace missing runId", () => {
    expect(() => TraceSchema.parse({ steps: [] })).toThrow();
  });
});
