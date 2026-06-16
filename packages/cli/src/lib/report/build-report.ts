import type { AgentConfig, BenchmarkSummary } from "@agentgrader/core";
import { aggregateResults } from "@agentgrader/optimizer";
import { getRun, getTraces, type AgrDb } from "@agentgrader/store";
import { countToolCalls, mergeToolCounts } from "../tool-usage";
import type { BenchReport, ReportRun } from "./types";

function parseMetrics(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function buildReportFromRunIds(
  db: AgrDb,
  runIds: string[],
  summary: BenchmarkSummary,
  agentConfigs: AgentConfig[],
  includeTraces: boolean,
): Promise<BenchReport> {
  const runs: ReportRun[] = [];
  const toolUsageByConfig: Record<string, Record<string, number>> = {};

  for (const runId of runIds) {
    const row = await getRun(db, runId);
    if (!row) continue;

    const reportRun: ReportRun = {
      runId: row.id,
      testCaseId: row.testCaseId,
      agentConfigId: row.agentConfigId,
      passed: row.passed ?? null,
      status: row.status,
      costUsd: row.costUsd ?? 0,
      durationMs: row.durationMs ?? 0,
      stepsCount: row.stepsCount ?? 0,
      tokensIn: row.tokensIn ?? 0,
      tokensOut: row.tokensOut ?? 0,
      matrixId: row.matrixId ?? null,
      error: row.error ?? null,
      metrics: parseMetrics(row.metrics),
      finalDiff: row.finalDiff ?? null,
    };

    if (includeTraces) {
      const traces = await getTraces(db, runId);
      reportRun.traces = traces.map((t) => ({
        stepIndex: t.stepIndex,
        kind: t.kind,
        tool: t.tool ?? null,
        content: t.content ?? null,
        tokensIn: t.tokensIn ?? 0,
        tokensOut: t.tokensOut ?? 0,
        costUsd: t.costUsd ?? 0,
      }));

      const counts = toolUsageByConfig[row.agentConfigId] ?? {};
      mergeToolCounts(counts, countToolCalls(traces));
      toolUsageByConfig[row.agentConfigId] = counts;
    }

    runs.push(reportRun);
  }

  const storeRuns = runs.map((r) => ({
    agentConfigId: r.agentConfigId,
    passed: r.passed,
    costUsd: r.costUsd,
    durationMs: r.durationMs,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    metrics: r.metrics,
  }));

  const aggregatesByConfig = aggregateResults(storeRuns, agentConfigs).map((a) => ({
    agentConfigId: a.agentConfigId,
    solveRate: a.solveRate,
    avgCostUsd: a.avgCostUsd,
    avgDurationMs: a.avgDurationMs,
    totalRuns: a.totalRuns,
    passedRuns: a.passedRuns,
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary,
    runs,
    aggregatesByConfig,
    toolUsageByConfig: Object.keys(toolUsageByConfig).length > 0 ? toolUsageByConfig : undefined,
  };
}
