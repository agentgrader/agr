export interface BaselineRunEntry {
  testCaseId: string;
  agentConfigId: string;
  passed: boolean | null;
  costUsd: number;
  durationMs: number;
  stepsCount: number;
  metrics: Record<string, unknown> | null;
}

export interface BaselineSnapshot {
  version: 1;
  createdAt: string;
  gitRef?: string;
  suite?: string;
  configs: string[];
  runs: BaselineRunEntry[];
  aggregates: {
    solveRate: number;
    avgCostUsd: number;
    totalRuns: number;
    passedRuns: number;
    toolUsage?: Record<string, Record<string, number>>;
  };
}

export interface BaselineDiff {
  solveRateDelta: number;
  costDeltaPct: number;
  perCaseDeltas: Array<{
    testCaseId: string;
    agentConfigId: string;
    baselinePassed: boolean | null;
    currentPassed: boolean | null;
    costDelta: number;
    status: "improved" | "regressed" | "unchanged" | "new" | "removed";
  }>;
  toolUsageDelta: Record<string, { baseline: number; current: number; deltaPct: number }>;
}

function runKey(testCaseId: string, agentConfigId: string): string {
  return `${testCaseId}::${agentConfigId}`;
}

export function createBaselineSnapshot(input: {
  suite?: string;
  configs: string[];
  gitRef?: string;
  runs: BaselineRunEntry[];
  toolUsage?: Record<string, Record<string, number>>;
}): BaselineSnapshot {
  const totalRuns = input.runs.length;
  const passedRuns = input.runs.filter((r) => r.passed).length;
  const avgCostUsd =
    totalRuns > 0 ? input.runs.reduce((sum, r) => sum + r.costUsd, 0) / totalRuns : 0;

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    gitRef: input.gitRef,
    suite: input.suite,
    configs: input.configs,
    runs: input.runs,
    aggregates: {
      solveRate: totalRuns > 0 ? passedRuns / totalRuns : 0,
      avgCostUsd,
      totalRuns,
      passedRuns,
      toolUsage: input.toolUsage,
    },
  };
}

export function diffSnapshots(baseline: BaselineSnapshot, current: BaselineSnapshot): BaselineDiff {
  const baselineMap = new Map(baseline.runs.map((r) => [runKey(r.testCaseId, r.agentConfigId), r]));
  const currentMap = new Map(current.runs.map((r) => [runKey(r.testCaseId, r.agentConfigId), r]));
  const allKeys = new Set([...baselineMap.keys(), ...currentMap.keys()]);

  const perCaseDeltas: BaselineDiff["perCaseDeltas"] = [];
  for (const key of allKeys) {
    const b = baselineMap.get(key);
    const c = currentMap.get(key);
    if (b && c) {
      const baselinePassed = b.passed;
      const currentPassed = c.passed;
      let status: BaselineDiff["perCaseDeltas"][number]["status"] = "unchanged";
      if (!baselinePassed && currentPassed) status = "improved";
      else if (baselinePassed && !currentPassed) status = "regressed";
      perCaseDeltas.push({
        testCaseId: c.testCaseId,
        agentConfigId: c.agentConfigId,
        baselinePassed,
        currentPassed,
        costDelta: c.costUsd - b.costUsd,
        status,
      });
    } else if (c) {
      perCaseDeltas.push({
        testCaseId: c.testCaseId,
        agentConfigId: c.agentConfigId,
        baselinePassed: null,
        currentPassed: c.passed,
        costDelta: c.costUsd,
        status: "new",
      });
    } else if (b) {
      perCaseDeltas.push({
        testCaseId: b.testCaseId,
        agentConfigId: b.agentConfigId,
        baselinePassed: b.passed,
        currentPassed: null,
        costDelta: -b.costUsd,
        status: "removed",
      });
    }
  }

  const solveRateDelta = current.aggregates.solveRate - baseline.aggregates.solveRate;
  const costDeltaPct =
    baseline.aggregates.avgCostUsd > 0
      ? ((current.aggregates.avgCostUsd - baseline.aggregates.avgCostUsd) /
          baseline.aggregates.avgCostUsd) *
        100
      : 0;

  const toolUsageDelta: BaselineDiff["toolUsageDelta"] = {};
  const baselineTools = baseline.aggregates.toolUsage ?? {};
  const currentTools = current.aggregates.toolUsage ?? {};
  const toolNames = new Set([
    ...Object.keys(baselineTools).flatMap((cfg) => Object.keys(baselineTools[cfg] ?? {})),
    ...Object.keys(currentTools).flatMap((cfg) => Object.keys(currentTools[cfg] ?? {})),
  ]);

  for (const tool of toolNames) {
    const baselineCount = Object.values(baselineTools).reduce(
      (sum, m) => sum + (m?.[tool] ?? 0),
      0,
    );
    const currentCount = Object.values(currentTools).reduce((sum, m) => sum + (m?.[tool] ?? 0), 0);
    toolUsageDelta[tool] = {
      baseline: baselineCount,
      current: currentCount,
      deltaPct:
        baselineCount > 0 ? ((currentCount - baselineCount) / baselineCount) * 100 : currentCount > 0 ? 100 : 0,
    };
  }

  return { solveRateDelta, costDeltaPct, perCaseDeltas, toolUsageDelta };
}

export function formatBaselineDiffMarkdown(
  diff: BaselineDiff,
  baseline: BaselineSnapshot,
  current: BaselineSnapshot,
  labels?: { baseline?: string; current?: string },
): string {
  const baselineLabel = labels?.baseline ?? baseline.gitRef ?? "baseline";
  const currentLabel = labels?.current ?? current.gitRef ?? "current";
  const lines: string[] = [];
  lines.push("## Agentgrader Baseline Comparison");
  lines.push("");
  lines.push("| Metric | Baseline | Current | Delta |");
  lines.push("| --- | --- | --- | --- |");
  lines.push(
    `| Solve rate | ${(baseline.aggregates.solveRate * 100).toFixed(0)}% | ${(current.aggregates.solveRate * 100).toFixed(0)}% | ${diff.solveRateDelta >= 0 ? "+" : ""}${(diff.solveRateDelta * 100).toFixed(0)}% |`,
  );
  lines.push(
    `| Avg cost | $${baseline.aggregates.avgCostUsd.toFixed(4)} | $${current.aggregates.avgCostUsd.toFixed(4)} | ${diff.costDeltaPct >= 0 ? "+" : ""}${diff.costDeltaPct.toFixed(1)}% |`,
  );

  const regressions = diff.perCaseDeltas.filter((d) => d.status === "regressed");
  if (regressions.length > 0) {
    lines.push("");
    lines.push("### Regressions");
    for (const r of regressions) {
      lines.push(`- ${r.testCaseId} / ${r.agentConfigId}: PASS -> FAIL`);
    }
  }

  const toolEntries = Object.entries(diff.toolUsageDelta).filter(([, v]) => v.deltaPct !== 0);
  if (toolEntries.length > 0) {
    lines.push("");
    lines.push("### Tool usage");
    lines.push("| Tool | Baseline | Current | Delta |");
    lines.push("| --- | --- | --- | --- |");
    for (const [tool, stats] of toolEntries) {
      lines.push(
        `| ${tool} | ${stats.baseline} | ${stats.current} | ${stats.deltaPct >= 0 ? "+" : ""}${stats.deltaPct.toFixed(0)}% |`,
      );
    }
  }

  lines.push("");
  lines.push(`Baseline: ${baselineLabel}. Current: ${currentLabel}.`);
  return `${lines.join("\n")}\n`;
}
