import { describe, expect, test } from "bun:test";
import { evaluateBenchExit } from "./bench-exit";
import type { BenchmarkSummary } from "@agentgrader/core";

const baseSummary: BenchmarkSummary = {
  totalRuns: 4,
  passedRuns: 3,
  failedRuns: 1,
  solveRate: 0.75,
  byConfig: {
    agentA: { totalRuns: 2, passedRuns: 2, failedRuns: 0, solveRate: 1 },
    agentB: { totalRuns: 2, passedRuns: 1, failedRuns: 1, solveRate: 0.5 },
  },
};

describe("evaluateBenchExit", () => {
  test("returns 0 with no options", () => {
    expect(evaluateBenchExit(baseSummary, {}).exitCode).toBe(0);
  });

  test("fail-on-failure exits 1 when any run failed", () => {
    const result = evaluateBenchExit(baseSummary, { failOnFailure: true });
    expect(result.exitCode).toBe(1);
    expect(result.reasons[0]).toContain("failed");
  });

  test("fail-on-failure exits 0 when all passed", () => {
    const allPass = { ...baseSummary, failedRuns: 0, passedRuns: 4, solveRate: 1 };
    expect(evaluateBenchExit(allPass, { failOnFailure: true }).exitCode).toBe(0);
  });

  test("min-solve-rate global scope", () => {
    const result = evaluateBenchExit(baseSummary, { minSolveRate: 0.8 });
    expect(result.exitCode).toBe(1);
    expect(result.reasons[0]).toContain("global solve rate");
  });

  test("min-solve-rate per-config scope", () => {
    const result = evaluateBenchExit(baseSummary, {
      minSolveRate: 0.9,
      minSolveRateScope: "per-config",
    });
    expect(result.exitCode).toBe(1);
    expect(result.reasons.some((r) => r.includes("agentB"))).toBe(true);
  });
});
