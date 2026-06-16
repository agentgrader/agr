import type { BenchReport } from "./types";
import { formatDuration } from "../format-relative-time";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatReportAsHtml(report: BenchReport): string {
  const solvePct = (report.summary.solveRate * 100).toFixed(1);
  const rows = report.runs
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.runId.slice(0, 8))}</td><td>${escapeHtml(r.testCaseId)}</td><td>${escapeHtml(r.agentConfigId)}</td><td>${r.passed ? "PASS" : "FAIL"}</td><td>$${r.costUsd.toFixed(4)}</td><td>${escapeHtml(formatDuration(r.durationMs))}</td><td>${r.stepsCount}</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Agentgrader Bench Report</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;color:#111}
h1,h2{margin-top:2rem}
table{border-collapse:collapse;width:100%;margin-top:1rem}
th,td{border:1px solid #ccc;padding:.5rem;text-align:left}
th{background:#f5f5f5}
.pass{color:#0a0}.fail{color:#a00}
.meta{color:#555}
</style>
</head>
<body>
<h1>Agentgrader Bench Report</h1>
<p class="meta">Generated ${escapeHtml(report.generatedAt)}</p>
<h2>Summary</h2>
<ul>
<li>Solve rate: <strong>${solvePct}%</strong> (${report.summary.passedRuns}/${report.summary.totalRuns})</li>
<li>Failed runs: ${report.summary.failedRuns}</li>
</ul>
<h2>Runs</h2>
<table>
<thead><tr><th>Run</th><th>Test case</th><th>Config</th><th>Result</th><th>Cost</th><th>Duration</th><th>Steps</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
}
