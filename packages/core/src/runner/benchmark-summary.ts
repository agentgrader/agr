import type { RunSingleResult } from "./run-single";

export interface BenchmarkSummary {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  solveRate: number;
  byConfig: Record<
    string,
    {
      totalRuns: number;
      passedRuns: number;
      failedRuns: number;
      solveRate: number;
    }
  >;
}

export function computeBenchmarkSummary(
  runs: RunSingleResult[],
  configIds?: string[],
): BenchmarkSummary {
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.passed).length;
  const failedRuns = totalRuns - passedRuns;
  const solveRate = totalRuns > 0 ? passedRuns / totalRuns : 0;

  const byConfig: BenchmarkSummary["byConfig"] = {};
  const ids = configIds ?? [];

  for (const configId of ids) {
    byConfig[configId] = { totalRuns: 0, passedRuns: 0, failedRuns: 0, solveRate: 0 };
  }

  return {
    totalRuns,
    passedRuns,
    failedRuns,
    solveRate,
    byConfig,
  };
}

export function mergeRunIntoSummary(
  summary: BenchmarkSummary,
  run: RunSingleResult & { agentConfigId?: string },
): BenchmarkSummary {
  const passed = !!run.passed;
  const next: BenchmarkSummary = {
    ...summary,
    totalRuns: summary.totalRuns + 1,
    passedRuns: summary.passedRuns + (passed ? 1 : 0),
    failedRuns: summary.failedRuns + (passed ? 0 : 1),
    byConfig: { ...summary.byConfig },
  };
  next.solveRate = next.totalRuns > 0 ? next.passedRuns / next.totalRuns : 0;

  if (run.agentConfigId) {
    const prev = next.byConfig[run.agentConfigId] ?? {
      totalRuns: 0,
      passedRuns: 0,
      failedRuns: 0,
      solveRate: 0,
    };
    const totalRuns = prev.totalRuns + 1;
    const passedRuns = prev.passedRuns + (passed ? 1 : 0);
    next.byConfig[run.agentConfigId] = {
      totalRuns,
      passedRuns,
      failedRuns: totalRuns - passedRuns,
      solveRate: totalRuns > 0 ? passedRuns / totalRuns : 0,
    };
  }

  return next;
}

export function summaryFromRunStates(
  runStates: Record<string, { passed?: boolean; status?: string; agentConfigId?: string }>,
  configIds: string[],
): BenchmarkSummary {
  let summary = computeBenchmarkSummary([], configIds);
  for (const [key, run] of Object.entries(runStates)) {
    if (run.status === "running") continue;
    const agentConfigId = run.agentConfigId ?? key.split("_").slice(1).join("_");
    summary = mergeRunIntoSummary(summary, {
      runId: "",
      passed: !!run.passed,
      stepsCount: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      durationMs: 0,
      agentConfigId,
    });
  }
  return summary;
}
