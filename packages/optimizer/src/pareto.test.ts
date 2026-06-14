import { describe, expect, test } from "bun:test";
import { paretoFront } from "./pareto";
import type { AggregateResult } from "./aggregate";

function agg(overrides: Partial<AggregateResult>): AggregateResult {
  return {
    agentConfigId: "cfg",
    agentConfigName: "cfg",
    totalRuns: 1,
    passedRuns: 1,
    solveRate: 1,
    avgCostUsd: 0,
    avgDurationMs: 0,
    avgTokensIn: 0,
    avgTokensOut: 0,
    ...overrides,
  };
}

describe("paretoFront", () => {
  test("returns an empty array for no aggregates", () => {
    expect(paretoFront([])).toEqual([]);
  });

  test("drops a config that is dominated on both solve rate and cost", () => {
    const better = agg({ agentConfigId: "better", solveRate: 1, avgCostUsd: 0.1 });
    const worse = agg({ agentConfigId: "worse", solveRate: 0.5, avgCostUsd: 0.2 });

    expect(paretoFront([better, worse])).toEqual([better]);
  });

  test("keeps both configs when each wins on a different objective (cheaper vs. higher solve rate)", () => {
    const cheaper = agg({ agentConfigId: "cheaper", solveRate: 0.5, avgCostUsd: 0.05 });
    const better = agg({ agentConfigId: "better", solveRate: 1, avgCostUsd: 0.2 });

    const front = paretoFront([cheaper, better]);
    expect(front).toHaveLength(2);
    expect(front.map((a) => a.agentConfigId).sort()).toEqual(["better", "cheaper"]);
  });

  test("only considers linterViolations when every aggregate has avgQuality.linterViolations", () => {
    const withQuality = agg({ agentConfigId: "with-quality", solveRate: 1, avgCostUsd: 0.1, avgQuality: { linterViolations: 5 } });
    const withoutQuality = agg({ agentConfigId: "without-quality", solveRate: 1, avgCostUsd: 0.1 });

    // Identical on solveRate/avgCostUsd, and the linterViolations objective is
    // dropped because `withoutQuality` has no avgQuality - so neither
    // dominates and both are kept.
    expect(paretoFront([withQuality, withoutQuality])).toHaveLength(2);
  });

  test("uses linterViolations (minimize) as a tiebreaker when both aggregates have avgQuality", () => {
    const cleaner = agg({ agentConfigId: "cleaner", solveRate: 1, avgCostUsd: 0.1, avgQuality: { linterViolations: 0 } });
    const dirtier = agg({ agentConfigId: "dirtier", solveRate: 1, avgCostUsd: 0.1, avgQuality: { linterViolations: 3 } });

    expect(paretoFront([cleaner, dirtier])).toEqual([cleaner]);
  });
});
