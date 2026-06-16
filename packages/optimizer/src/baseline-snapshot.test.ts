import { describe, expect, test } from "bun:test";
import {
  createBaselineSnapshot,
  diffSnapshots,
  formatBaselineDiffMarkdown,
} from "./baseline-snapshot";

describe("baseline snapshot", () => {
  test("diffSnapshots detects regression", () => {
    const baseline = createBaselineSnapshot({
      configs: ["agent"],
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 100, stepsCount: 5, metrics: null },
      ],
    });
    const current = createBaselineSnapshot({
      configs: ["agent"],
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: false, costUsd: 0.02, durationMs: 120, stepsCount: 6, metrics: null },
      ],
    });
    const diff = diffSnapshots(baseline, current);
    expect(diff.perCaseDeltas[0]?.status).toBe("regressed");
    expect(diff.solveRateDelta).toBe(-1);
  });

  test("formatBaselineDiffMarkdown lists regressions and solve-rate delta", () => {
    const baseline = createBaselineSnapshot({
      configs: ["agent"],
      gitRef: "main",
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 100, stepsCount: 5, metrics: null },
        { testCaseId: "b", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 100, stepsCount: 5, metrics: null },
      ],
    });
    const current = createBaselineSnapshot({
      configs: ["agent"],
      gitRef: "pr-42",
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: false, costUsd: 0.02, durationMs: 120, stepsCount: 6, metrics: null },
        { testCaseId: "b", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 100, stepsCount: 5, metrics: null },
      ],
    });
    const diff = diffSnapshots(baseline, current);
    const md = formatBaselineDiffMarkdown(diff, baseline, current);

    expect(md).toContain("## Agentgrader Baseline Comparison");
    expect(md).toContain("### Regressions");
    expect(md).toContain("a / agent: PASS -> FAIL");
    expect(md).toContain("Baseline: main");
    expect(md).toContain("Current: pr-42");
    expect(md).toContain("Avg duration");
    expect(md).toContain("Avg steps");
  });

  test("createBaselineSnapshot computes avgDurationMs and avgStepsCount", () => {
    const snapshot = createBaselineSnapshot({
      configs: ["agent"],
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 1000, stepsCount: 4, metrics: null },
        { testCaseId: "b", agentConfigId: "agent", passed: true, costUsd: 0.02, durationMs: 3000, stepsCount: 8, metrics: null },
      ],
    });
    expect(snapshot.aggregates.avgDurationMs).toBe(2000);
    expect(snapshot.aggregates.avgStepsCount).toBe(6);
  });

  test("createBaselineSnapshot computes avgTokensIn/avgTokensOut when token data present", () => {
    const snapshot = createBaselineSnapshot({
      configs: ["agent"],
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 1000, stepsCount: 4, tokensIn: 100, tokensOut: 40, metrics: null },
        { testCaseId: "b", agentConfigId: "agent", passed: true, costUsd: 0.02, durationMs: 3000, stepsCount: 8, tokensIn: 200, tokensOut: 60, metrics: null },
      ],
    });
    expect(snapshot.aggregates.avgTokensIn).toBe(150);
    expect(snapshot.aggregates.avgTokensOut).toBe(50);
  });

  test("createBaselineSnapshot omits avgTokensIn/avgTokensOut when no token data", () => {
    const snapshot = createBaselineSnapshot({
      configs: ["agent"],
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 1000, stepsCount: 4, metrics: null },
      ],
    });
    expect(snapshot.aggregates.avgTokensIn).toBeUndefined();
    expect(snapshot.aggregates.avgTokensOut).toBeUndefined();
  });

  test("formatBaselineDiffMarkdown includes Avg tokens rows when token data present", () => {
    const baseline = createBaselineSnapshot({
      configs: ["agent"],
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 1000, stepsCount: 4, tokensIn: 100, tokensOut: 40, metrics: null },
      ],
    });
    const current = createBaselineSnapshot({
      configs: ["agent"],
      runs: [
        { testCaseId: "a", agentConfigId: "agent", passed: true, costUsd: 0.01, durationMs: 1000, stepsCount: 4, tokensIn: 120, tokensOut: 50, metrics: null },
      ],
    });
    const diff = diffSnapshots(baseline, current);
    const md = formatBaselineDiffMarkdown(diff, baseline, current);
    expect(md).toContain("Avg tokens in");
    expect(md).toContain("Avg tokens out");
    expect(md).toContain("+20.0%");
  });
});
