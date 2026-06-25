import type { BenchmarkSummary } from "@agentgrader/core";

export type MinSolveRateScope = "global" | "per-config";

export interface BenchExitOptions {
  failOnFailure?: boolean;
  minSolveRate?: number;
  minSolveRateScope?: MinSolveRateScope;
  minPassCount?: number;
}

export function evaluateBenchExit(
  summary: BenchmarkSummary,
  opts: BenchExitOptions,
): { exitCode: number; reasons: string[] } {
  const reasons: string[] = [];

  if (opts.failOnFailure && summary.failedRuns > 0) {
    reasons.push(`${summary.failedRuns}/${summary.totalRuns} run(s) failed`);
  }

  if (opts.minSolveRate !== undefined) {
    const scope = opts.minSolveRateScope ?? "global";
    if (scope === "global") {
      if (summary.solveRate < opts.minSolveRate) {
        reasons.push(
          `global solve rate ${(summary.solveRate * 100).toFixed(1)}% is below minimum ${(opts.minSolveRate * 100).toFixed(1)}%`,
        );
      }
    } else {
      for (const [configId, stats] of Object.entries(summary.byConfig)) {
        if (stats.totalRuns === 0) continue;
        if (stats.solveRate < opts.minSolveRate) {
          reasons.push(
            `config "${configId}" solve rate ${(stats.solveRate * 100).toFixed(1)}% is below minimum ${(opts.minSolveRate * 100).toFixed(1)}%`,
          );
        }
      }
    }
  }

  if (opts.minPassCount !== undefined && summary.passedRuns < opts.minPassCount) {
    reasons.push(
      `only ${summary.passedRuns} run(s) passed; minimum required is ${opts.minPassCount}`,
    );
  }

  return { exitCode: reasons.length > 0 ? 1 : 0, reasons };
}
