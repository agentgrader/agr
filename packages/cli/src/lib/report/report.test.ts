import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatReportAsJson } from "./format-json";
import { formatReportAsJsonl } from "./format-jsonl";
import { formatReportAsMarkdown } from "./format-md";
import { resolveReportOutputPath, writeReport } from "./write-report";
import type { BenchReport } from "./types";

const sampleReport: BenchReport = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalRuns: 2,
    passedRuns: 1,
    failedRuns: 1,
    solveRate: 0.5,
    byConfig: {},
  },
  runs: [
    {
      runId: "run-1",
      testCaseId: "case-a",
      agentConfigId: "agent",
      passed: true,
      status: "completed",
      costUsd: 0.01,
      durationMs: 100,
      stepsCount: 3,
      tokensIn: 10,
      tokensOut: 5,
      matrixId: null,
      error: null,
      metrics: null,
      finalDiff: null,
    },
    {
      runId: "run-2",
      testCaseId: "case-b",
      agentConfigId: "agent",
      passed: false,
      status: "completed",
      costUsd: 0.02,
      durationMs: 200,
      stepsCount: 5,
      tokensIn: 20,
      tokensOut: 10,
      matrixId: null,
      error: "timeout",
      metrics: null,
      finalDiff: null,
    },
  ],
  aggregatesByConfig: [
    {
      agentConfigId: "agent",
      solveRate: 0.5,
      avgCostUsd: 0.015,
      avgDurationMs: 150,
      avgStepsCount: 4,
      totalRuns: 2,
      passedRuns: 1,
    },
  ],
};

describe("report formatters", () => {
  test("formatReportAsJson round-trips summary", () => {
    const parsed = JSON.parse(formatReportAsJson(sampleReport));
    expect(parsed.summary.solveRate).toBe(0.5);
    expect(parsed.runs).toHaveLength(2);
  });

  test("formatReportAsJsonl emits typed lines", () => {
    const lines = formatReportAsJsonl(sampleReport).trim().split("\n");
    expect(lines).toHaveLength(4);
    expect(JSON.parse(lines[0]!).type).toBe("summary");
    expect(JSON.parse(lines[1]!).type).toBe("run");
    expect(JSON.parse(lines[2]!).type).toBe("run");
    expect(JSON.parse(lines[3]!).type).toBe("aggregate");
  });

  test("formatReportAsMarkdown includes pass/fail rows", () => {
    const md = formatReportAsMarkdown(sampleReport);
    expect(md).toContain("case-a");
    expect(md).toContain("PASS");
    expect(md).toContain("FAIL");
    expect(md).toContain("50.0%");
  });
});

describe("writeReport", () => {
  test("resolveReportOutputPath appends extension when missing", () => {
    expect(resolveReportOutputPath("json", "reports/bench")).toBe("reports/bench.json");
    expect(resolveReportOutputPath("md", "reports/bench.md")).toBe("reports/bench.md");
  });

  test("writes markdown report to disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "agr-report-"));
    try {
      const path = writeReport(sampleReport, "md", join(dir, "bench"));
      expect(readFileSync(path, "utf-8")).toContain("# Agentgrader Bench Report");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
