import { describe, expect, test } from "bun:test";
import { RunSchema } from "./run";

describe("RunSchema", () => {
  const minimal = {
    id: "run-1",
    testCaseId: "cleanup-unused-import",
    agentConfigId: "claude-haiku-jetbrains-tools",
    sandboxProvider: "local",
    status: "running" as const,
    createdAt: 1_700_000_000_000,
  };

  test("accepts a minimal run and defaults numeric counters to 0", () => {
    const result = RunSchema.parse(minimal);
    expect(result.stepsCount).toBe(0);
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.costUsd).toBe(0);
    expect(result.durationMs).toBe(0);
    expect(result.passed).toBeUndefined();
    expect(result.completedAt).toBeUndefined();
  });

  test("rejects a run missing required fields", () => {
    expect(() => RunSchema.parse({ ...minimal, id: undefined })).toThrow();
    expect(() => RunSchema.parse({ ...minimal, createdAt: undefined })).toThrow();
  });

  test.each(["running", "completed", "failed"])("accepts status %s", (status) => {
    expect(() => RunSchema.parse({ ...minimal, status })).not.toThrow();
  });

  test("rejects an invalid status", () => {
    expect(() => RunSchema.parse({ ...minimal, status: "pending" })).toThrow();
  });

  test("accepts a completed run with scoring metrics and metadata", () => {
    const result = RunSchema.parse({
      ...minimal,
      status: "completed",
      passed: true,
      score: 1,
      stepsCount: 32,
      tokensIn: 12_000,
      tokensOut: 800,
      costUsd: 0.0739,
      durationMs: 45_000,
      finalDiff: "diff --git a/foo.py b/foo.py",
      metrics: { "tool-usage": { used: [], unused: ["show-diff"] } },
      matrixId: "matrix-jetbrains-toolkits",
      completedAt: 1_700_000_100_000,
    });
    expect(result.passed).toBe(true);
    expect(result.metrics?.["tool-usage"]).toEqual({ used: [], unused: ["show-diff"] });
    expect(result.matrixId).toBe("matrix-jetbrains-toolkits");
  });

  test("accepts a failed run with an error message", () => {
    const result = RunSchema.parse({
      ...minimal,
      status: "failed",
      error: "step_timeout_ms exceeded",
    });
    expect(result.error).toBe("step_timeout_ms exceeded");
  });
});
