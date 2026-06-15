import type { BenchReport } from "./types";

export function formatReportAsJson(report: BenchReport): string {
  return JSON.stringify(report, null, 2);
}
