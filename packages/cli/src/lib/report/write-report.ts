import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import type { BenchReport, ReportFormat } from "./types";
export type { ReportFormat } from "./types";
import { formatReportAsHtml } from "./format-html";
import { formatReportAsJson } from "./format-json";
import { formatReportAsJsonl } from "./format-jsonl";
import { formatReportAsMarkdown } from "./format-md";

const DEFAULT_EXT: Record<ReportFormat, string> = {
  json: ".json",
  jsonl: ".jsonl",
  html: ".html",
  md: ".md",
};

export function resolveReportOutputPath(format: ReportFormat, output: string): string {
  const ext = extname(output);
  if (ext) return output;
  return `${output}${DEFAULT_EXT[format]}`;
}

export function buildTimestampedReportPath(dir: string, format: ReportFormat, prefix = "bench"): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `${dir}/${prefix}-${ts}${DEFAULT_EXT[format]}`;
}

export function writeReport(
  report: BenchReport,
  format: ReportFormat,
  outputPath: string,
): string {
  const path = resolveReportOutputPath(format, outputPath);
  mkdirSync(dirname(path), { recursive: true });

  let content: string;
  switch (format) {
    case "json":
      content = formatReportAsJson(report);
      break;
    case "jsonl":
      content = formatReportAsJsonl(report);
      break;
    case "html":
      content = formatReportAsHtml(report);
      break;
    case "md":
      content = formatReportAsMarkdown(report);
      break;
  }

  writeFileSync(path, content, "utf-8");
  return path;
}
