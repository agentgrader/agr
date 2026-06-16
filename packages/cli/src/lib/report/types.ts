import type { BenchmarkSummary } from "@agentgrader/core";

export type ReportFormat = "json" | "jsonl" | "html" | "md";

export interface ReportRun {
  runId: string;
  testCaseId: string;
  agentConfigId: string;
  passed: boolean | null;
  status: string;
  costUsd: number;
  durationMs: number;
  stepsCount: number;
  tokensIn: number;
  tokensOut: number;
  matrixId: string | null;
  error: string | null;
  metrics: Record<string, unknown> | null;
  finalDiff: string | null;
  traces?: Array<{
    stepIndex: number;
    kind: string;
    tool: string | null;
    content: string | null;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  }>;
}

export interface BenchReport {
  generatedAt: string;
  summary: BenchmarkSummary;
  runs: ReportRun[];
  aggregatesByConfig?: Array<{
    agentConfigId: string;
    solveRate: number;
    avgCostUsd: number;
    avgDurationMs: number;
    avgStepsCount: number;
    totalRuns: number;
    passedRuns: number;
  }>;
  toolUsageByConfig?: Record<string, Record<string, number>>;
}
