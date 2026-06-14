import { describe, expect, test } from "bun:test";
import { aggregateResults, type RunRecord } from "./aggregate";
import type { AgentConfig } from "@agentgrader/core";

const configs: AgentConfig[] = [
  { id: "cfg-a", name: "Config A", model: "claude-haiku-4-5-20251001", max_steps: 30 },
];

describe("aggregateResults", () => {
  test("computes solve rate and cost/duration/token averages, grouped by agentConfigId", () => {
    const runs: RunRecord[] = [
      { agentConfigId: "cfg-a", passed: true, costUsd: 0.1, durationMs: 1000, tokensIn: 100, tokensOut: 50 },
      { agentConfigId: "cfg-a", passed: false, costUsd: 0.2, durationMs: 2000, tokensIn: 200, tokensOut: 100 },
    ];

    const [result] = aggregateResults(runs, configs);

    expect(result!.agentConfigId).toBe("cfg-a");
    expect(result!.agentConfigName).toBe("Config A");
    expect(result!.totalRuns).toBe(2);
    expect(result!.passedRuns).toBe(1);
    expect(result!.solveRate).toBe(0.5);
    expect(result!.avgCostUsd).toBeCloseTo(0.15, 5);
    expect(result!.avgDurationMs).toBe(1500);
    expect(result!.avgTokensIn).toBe(150);
    expect(result!.avgTokensOut).toBe(75);
  });

  test("falls back to agentConfigId as the name when no matching config is found", () => {
    const [result] = aggregateResults([{ agentConfigId: "unknown-cfg", passed: true }], configs);
    expect(result!.agentConfigName).toBe("unknown-cfg");
  });

  test("treats missing costUsd/durationMs/tokens as zero", () => {
    const [result] = aggregateResults([{ agentConfigId: "cfg-a", passed: true }], configs);
    expect(result!.avgCostUsd).toBe(0);
    expect(result!.avgDurationMs).toBe(0);
    expect(result!.avgTokensIn).toBe(0);
    expect(result!.avgTokensOut).toBe(0);
  });

  test("averages static-quality metrics when every run has them, parsing JSON-string metrics", () => {
    const runs: RunRecord[] = [
      {
        agentConfigId: "cfg-a",
        passed: true,
        metrics: JSON.stringify({ "static-quality": { quality: { diffLines: 4, filesModified: 1, todosIntroduced: 0, linterViolations: 2 } } }),
      },
      {
        agentConfigId: "cfg-a",
        passed: true,
        metrics: { "static-quality": { quality: { diffLines: 6, filesModified: 1, todosIntroduced: 2, linterViolations: 0 } } },
      },
    ];

    const [result] = aggregateResults(runs, configs);

    expect(result!.avgQuality).toEqual({
      diffLines: 5,
      filesModified: 1,
      todosIntroduced: 1,
      linterViolations: 1,
    });
  });

  test("omits avgQuality when not every run has static-quality metrics", () => {
    const runs: RunRecord[] = [
      { agentConfigId: "cfg-a", passed: true, metrics: { "static-quality": { quality: { diffLines: 4 } } } },
      { agentConfigId: "cfg-a", passed: true, metrics: null },
    ];

    const [result] = aggregateResults(runs, configs);
    expect(result!.avgQuality).toBeUndefined();
  });

  test("ignores unparseable metrics JSON strings", () => {
    const runs: RunRecord[] = [{ agentConfigId: "cfg-a", passed: true, metrics: "not json" }];
    const [result] = aggregateResults(runs, configs);
    expect(result!.avgQuality).toBeUndefined();
  });
});
