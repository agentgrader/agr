import type { BenchReport } from "./types";

export function formatReportAsJsonl(report: BenchReport): string {
  const lines: string[] = [];
  lines.push(JSON.stringify({ type: "summary", ...report.summary, generatedAt: report.generatedAt }));
  for (const run of report.runs) {
    lines.push(JSON.stringify({ type: "run", ...run }));
  }
  if (report.aggregatesByConfig) {
    for (const agg of report.aggregatesByConfig) {
      lines.push(JSON.stringify({ type: "aggregate", ...agg }));
    }
  }
  return `${lines.join("\n")}\n`;
}
