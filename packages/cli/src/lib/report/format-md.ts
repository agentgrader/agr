import type { BenchReport } from "./types";
import { formatDuration } from "../format-relative-time";

export function formatReportAsMarkdown(report: BenchReport): string {
  const lines: string[] = [];
  lines.push("# Agentgrader Bench Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Solve rate: **${(report.summary.solveRate * 100).toFixed(1)}%** (${report.summary.passedRuns}/${report.summary.totalRuns})`);
  lines.push(`- Failed runs: ${report.summary.failedRuns}`);
  lines.push("");
  lines.push("## Runs");
  lines.push("");
  lines.push("| Test case | Config | Result | Cost | Duration | Steps |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const run of report.runs) {
    lines.push(
      `| ${run.testCaseId} | ${run.agentConfigId} | ${run.passed ? "PASS" : "FAIL"} | $${run.costUsd.toFixed(4)} | ${formatDuration(run.durationMs)} | ${run.stepsCount} |`,
    );
  }

  if (report.aggregatesByConfig && report.aggregatesByConfig.length > 0) {
    lines.push("");
    lines.push("## By config");
    lines.push("");
    lines.push("| Config | Solve rate | Avg cost | Avg duration | Avg steps | Avg tokens in | Avg tokens out | Passed | Total |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const agg of report.aggregatesByConfig) {
      lines.push(
        `| ${agg.agentConfigId} | ${(agg.solveRate * 100).toFixed(1)}% | $${agg.avgCostUsd.toFixed(4)} | ${formatDuration(agg.avgDurationMs)} | ${Math.round(agg.avgStepsCount)} | ${Math.round(agg.avgTokensIn)} | ${Math.round(agg.avgTokensOut)} | ${agg.passedRuns} | ${agg.totalRuns} |`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
