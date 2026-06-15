import { describe, expect, test } from "bun:test";
import {
  computeBenchmarkSummary,
  mergeRunIntoSummary,
  summaryFromRunStates,
} from "./benchmark-summary";

describe("computeBenchmarkSummary", () => {
  test("computes totals from an empty run list", () => {
    const summary = computeBenchmarkSummary([], ["cfg-a"]);
    expect(summary).toEqual({
      totalRuns: 0,
      passedRuns: 0,
      failedRuns: 0,
      solveRate: 0,
      byConfig: {
        "cfg-a": { totalRuns: 0, passedRuns: 0, failedRuns: 0, solveRate: 0 },
      },
    });
  });
});

describe("mergeRunIntoSummary", () => {
  test("increments global and per-config counters", () => {
    let summary = computeBenchmarkSummary([], ["agent-a", "agent-b"]);
    summary = mergeRunIntoSummary(summary, {
      runId: "1",
      passed: true,
      stepsCount: 1,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      durationMs: 0,
      agentConfigId: "agent-a",
    });
    summary = mergeRunIntoSummary(summary, {
      runId: "2",
      passed: false,
      stepsCount: 1,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      durationMs: 0,
      agentConfigId: "agent-b",
    });

    expect(summary.totalRuns).toBe(2);
    expect(summary.passedRuns).toBe(1);
    expect(summary.failedRuns).toBe(1);
    expect(summary.solveRate).toBe(0.5);
    expect(summary.byConfig["agent-a"]).toEqual({
      totalRuns: 1,
      passedRuns: 1,
      failedRuns: 0,
      solveRate: 1,
    });
    expect(summary.byConfig["agent-b"]).toEqual({
      totalRuns: 1,
      passedRuns: 0,
      failedRuns: 1,
      solveRate: 0,
    });
  });
});

describe("summaryFromRunStates", () => {
  test("skips running entries and derives agentConfigId from key suffix", () => {
    const summary = summaryFromRunStates(
      {
        "case_agent-a": { passed: true, status: "completed", agentConfigId: "agent-a" },
        "case_agent-b": { passed: false, status: "completed" },
        "case_agent-c": { passed: true, status: "running" },
      },
      ["agent-a", "agent-b"],
    );

    expect(summary.totalRuns).toBe(2);
    expect(summary.passedRuns).toBe(1);
    expect(summary.byConfig["agent-b"]?.totalRuns).toBe(1);
  });
});
