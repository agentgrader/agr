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
  });
});
