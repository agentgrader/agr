import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { initDb, getTraces, listRuns, agentConfigs, type AgrDb } from "@agentgrader/store";
import { tracesToOtelJson, tracesToOtelJsonl } from "../lib/export/otel";
import { parseSince } from "../lib/parse-since";

export type ExportSortField = "date" | "cost" | "duration" | "steps";

export async function exportCommand(
  subcommand: string,
  opts: {
    format?: "json" | "jsonl" | "otlp" | "csv";
    output?: string;
    db?: string;
    runId?: string;
    last?: boolean;
    matrixId?: string;
    lastMatrix?: boolean;
    limit?: number;
    since?: string;
    testCase?: string;
    config?: string;
    passed?: boolean;
    model?: string;
    sort?: ExportSortField;
    sandbox?: string;
    error?: string;
    columns?: string[];
    all?: boolean;
    deduplicate?: boolean;
    runIdsFile?: string;
  },
) {
  const db = initDb(opts.db ?? ".agr/db.sqlite");
  const format = opts.format ?? "json";
  const ext = format === "jsonl" ? "jsonl" : format === "csv" ? "csv" : "json";
  const output = opts.output ?? `export-${subcommand}.${ext}`;

  if (subcommand === "traces") {
    const hasFilters = opts.testCase || opts.config || opts.since || opts.passed !== undefined;
    const hasRunSelector = opts.runId || opts.last;

    if (!hasRunSelector && !hasFilters && !opts.all) {
      console.error("--run-id is required for `agr export traces` (or use --last, --test-case, --config, or --all)");
      process.exit(1);
    }

    if ((hasFilters || opts.all) && !hasRunSelector) {
      // Multi-run trace export filtered by test case / config / since / passed / limit (or all)
      let runs = await listRuns(db);
      if (opts.testCase) {
        const tc = opts.testCase;
        runs = runs.filter((r) => r.testCaseId === tc || r.testCaseId.includes(tc));
      }
      if (opts.config) {
        const cfg = opts.config;
        runs = runs.filter((r) => r.agentConfigId === cfg || r.agentConfigId.includes(cfg));
      }
      if (opts.since) {
        const sinceTs = parseSince(opts.since);
        runs = runs.filter((r) => r.createdAt >= sinceTs);
      }
      if (opts.passed !== undefined) {
        runs = runs.filter((r) => r.passed === opts.passed);
      }
      if (opts.limit) runs = runs.slice(0, opts.limit);
      if (runs.length === 0) {
        console.error("No matching runs found. Check filters with `agr list --plain`.");
        process.exit(1);
      }
      console.log(`Exporting traces for ${runs.length} run(s)...`);
      if (format === "jsonl" || format === "otlp") {
        const lines: string[] = [];
        for (const run of runs) {
          const traces = await getTraces(db, run.id);
          lines.push(tracesToOtelJsonl(run.id, traces));
        }
        writeExport(output, lines.join(""), runs.length);
      } else {
        const allExports = [];
        for (const run of runs) {
          const traces = await getTraces(db, run.id);
          allExports.push({
            runId: run.id,
            testCaseId: run.testCaseId,
            agentConfigId: run.agentConfigId,
            passed: run.passed,
            ...tracesToOtelJson(run.id, traces),
          });
        }
        writeExport(output, JSON.stringify(allExports, null, 2), runs.length);
      }
      return;
    }

    // Single-run export: --run-id or --last (with optional --test-case / --config scoping)
    let resolvedRunId = opts.runId;
    if (opts.last) {
      let runs = await listRuns(db);
      if (opts.testCase) {
        const tc = opts.testCase;
        runs = runs.filter((r) => r.testCaseId === tc || r.testCaseId.includes(tc));
      }
      if (opts.config) {
        const cfg = opts.config;
        runs = runs.filter((r) => r.agentConfigId === cfg || r.agentConfigId.includes(cfg));
      }
      if (runs.length === 0) {
        const parts: string[] = ["No runs found"];
        if (opts.testCase) parts.push(`for test case "${opts.testCase}"`);
        if (opts.config) parts.push(`for config "${opts.config}"`);
        console.error(`${parts.join(" ")}. Check \`agr list --plain\`.`);
        process.exit(1);
      }
      resolvedRunId = runs[0]!.id;
    }
    if (!resolvedRunId) {
      console.error("--run-id is required for `agr export traces` (or use --last, --test-case, or --config)");
      process.exit(1);
    }
    const traces = await getTraces(db, resolvedRunId);
    const content =
      format === "otlp" || format === "jsonl"
        ? tracesToOtelJsonl(resolvedRunId, traces)
        : JSON.stringify(tracesToOtelJson(resolvedRunId, traces), null, 2);
    writeExport(output, content, traces.length);
    return;
  }

  if (subcommand === "runs") {
    let runs = await listRuns(db);
    let resolvedMatrixId = opts.matrixId;
    if (opts.lastMatrix) {
      const matrixRun = runs.find((r) => r.matrixId);
      if (!matrixRun?.matrixId) {
        console.error("No matrix runs found in .agr/db.sqlite. Run `agr bench --matrix` first.");
        process.exit(1);
      }
      resolvedMatrixId = matrixRun.matrixId;
      console.log(`Using most recent matrix: ${resolvedMatrixId}`);
    }
    if (resolvedMatrixId) runs = runs.filter((r) => r.matrixId === resolvedMatrixId);
    if (opts.runIdsFile) {
      const { readFileSync } = await import("node:fs");
      const { resolve: resolvePath } = await import("node:path");
      const idSet = new Set(readFileSync(resolvePath(opts.runIdsFile), "utf-8").split("\n").map(l => l.trim()).filter(Boolean));
      runs = runs.filter((r) => idSet.has(r.id));
      if (runs.length === 0) {
        console.error(`No runs found matching IDs in "${opts.runIdsFile}". Check the file contains valid run IDs.`);
        process.exit(1);
      }
      console.log(`Filtering to ${runs.length} run(s) from ${opts.runIdsFile}`);
    }
    if (opts.since) {
      const sinceTs = parseSince(opts.since);
      runs = runs.filter((r) => r.createdAt >= sinceTs);
      if (runs.length === 0) {
        console.error(`No runs found since ${opts.since} (${new Date(sinceTs * 1000).toISOString()}). Use a wider window.`);
        process.exit(1);
      }
      console.log(`Filtering to ${runs.length} run(s) since ${opts.since} (${new Date(sinceTs * 1000).toISOString()})`);
    }
    if (opts.passed !== undefined) {
      runs = runs.filter((r) => r.passed === opts.passed);
      if (runs.length === 0) {
        const label = opts.passed ? "passed" : "failed";
        console.error(`No ${label} runs found. Check \`agr status\` for current DB contents.`);
        process.exit(1);
      }
      console.log(`Filtering to ${runs.length} ${opts.passed ? "passed" : "failed"} run(s)`);
    }
    if (opts.testCase) {
      const tc = opts.testCase;
      runs = runs.filter((r) => r.testCaseId === tc || r.testCaseId.includes(tc));
      if (runs.length === 0) {
        console.error(`No runs found for test case "${tc}". Check the ID with \`agr list --plain\`.`);
        process.exit(1);
      }
      console.log(`Filtering to ${runs.length} run(s) for test case "${tc}"`);
    }
    if (opts.config) {
      const cfg = opts.config;
      runs = runs.filter((r) => r.agentConfigId === cfg || r.agentConfigId.includes(cfg));
      if (runs.length === 0) {
        console.error(`No runs found for config "${cfg}". Check the ID with \`agr list --plain\`.`);
        process.exit(1);
      }
      console.log(`Filtering to ${runs.length} run(s) for config "${cfg}"`);
    }
    if (opts.model) {
      const cfgRows = await db.select().from(agentConfigs);
      const modelByConfigId = new Map(cfgRows.map((r) => [r.id, r.model ?? ""]));
      const mf = opts.model.toLowerCase();
      runs = runs.filter((r) => (modelByConfigId.get(r.agentConfigId) ?? "").toLowerCase().includes(mf));
      if (runs.length === 0) {
        console.error(`No runs found for model "${opts.model}". Check model names with \`agr status --by-model\`.`);
        process.exit(1);
      }
      console.log(`Filtering to ${runs.length} run(s) for model matching "${opts.model}"`);
    }
    if (opts.sandbox) {
      const sf = opts.sandbox.toLowerCase();
      runs = runs.filter((r) => (r.sandboxProvider ?? "").toLowerCase().includes(sf));
      if (runs.length === 0) {
        console.error(`No runs found for sandbox "${opts.sandbox}". Check sandbox names with \`agr status --by-sandbox\`.`);
        process.exit(1);
      }
      console.log(`Filtering to ${runs.length} run(s) for sandbox matching "${opts.sandbox}"`);
    }
    if (opts.error) {
      const ef = opts.error.toLowerCase();
      runs = runs.filter((r) => (r.error ?? "").toLowerCase().includes(ef));
      if (runs.length === 0) {
        console.error(`No runs found with error matching "${opts.error}". Check error messages with \`agr list --plain --failed\`.`);
        process.exit(1);
      }
      console.log(`Filtering to ${runs.length} run(s) with error matching "${opts.error}"`);
    }
    if (opts.sort && opts.sort !== "date") {
      const key = opts.sort === "cost" ? "costUsd" : opts.sort === "duration" ? "durationMs" : "stepsCount";
      runs = [...runs].sort((a, b) => ((b[key] as number | null) ?? 0) - ((a[key] as number | null) ?? 0));
    }
    if (opts.limit) runs = runs.slice(0, opts.limit);
    if (opts.deduplicate) {
      const seen = new Set<string>();
      runs = runs.filter((r) => {
        const key = `${r.testCaseId}::${r.agentConfigId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      console.log(`--deduplicate: kept ${runs.length} run(s) (most recent per test case + config pair)`);
    }
    const allColumns = ["id", "testCaseId", "agentConfigId", "status", "passed", "costUsd", "durationMs", "stepsCount", "tokensIn", "tokensOut", "error", "sandboxProvider", "createdAt", "matrixId", "metrics"] as const;
    const selectedColumns = opts.columns && opts.columns.length > 0
      ? allColumns.filter((c) => opts.columns!.includes(c))
      : allColumns;
    if (opts.columns && opts.columns.length > 0) {
      const unknown = opts.columns.filter((c) => !allColumns.includes(c as typeof allColumns[number]));
      if (unknown.length > 0) console.warn(`[warn] Unknown column(s) ignored: ${unknown.join(", ")}. Valid: ${allColumns.join(", ")}`);
    }
    const fullPayload = runs.map((r) => ({
      id: r.id,
      testCaseId: r.testCaseId,
      agentConfigId: r.agentConfigId,
      status: r.status,
      passed: r.passed,
      costUsd: r.costUsd,
      durationMs: r.durationMs,
      stepsCount: r.stepsCount,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      error: r.error ?? null,
      sandboxProvider: r.sandboxProvider,
      createdAt: r.createdAt,
      matrixId: r.matrixId,
      metrics: r.metrics ? JSON.parse(r.metrics) : null,
    }));
    const payload = fullPayload.map((row) => Object.fromEntries(selectedColumns.map((c) => [c, row[c]])));
    let content: string;
    if (format === "jsonl") {
      content = `${payload.map((row) => JSON.stringify(row)).join("\n")}\n`;
    } else if (format === "csv") {
      content = runsToCSV(fullPayload, selectedColumns as string[]);
    } else {
      content = JSON.stringify(payload, null, 2);
    }
    writeExport(output, content, payload.length);
    return;
  }

  if (subcommand === "summary") {
    const allRuns = await listRuns(db);
    let runs = allRuns;
    if (opts.since) {
      const sinceTs = parseSince(opts.since);
      runs = runs.filter((r) => r.createdAt >= sinceTs);
    }
    const output = opts.output ?? "export-summary.json";
    const totalRuns = runs.length;
    const passedRuns = runs.filter((r) => r.passed === true).length;
    const failedRuns = runs.filter((r) => r.passed === false).length;
    const totalCostUsd = runs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
    // byTestCase
    const tcMap = new Map<string, { total: number; passed: number; failed: number; totalCostUsd: number }>();
    for (const r of runs) {
      const e = tcMap.get(r.testCaseId) ?? { total: 0, passed: 0, failed: 0, totalCostUsd: 0 };
      e.total++; if (r.passed === true) e.passed++; if (r.passed === false) e.failed++;
      e.totalCostUsd += r.costUsd ?? 0; tcMap.set(r.testCaseId, e);
    }
    const byTestCase = [...tcMap.entries()].map(([testCaseId, e]) => ({
      testCaseId, total: e.total, passed: e.passed, failed: e.failed,
      solveRate: e.total > 0 ? e.passed / e.total : 0, avgCostUsd: e.total > 0 ? e.totalCostUsd / e.total : 0,
    })).sort((a, b) => a.solveRate - b.solveRate);
    // byConfig
    const cfgMap = new Map<string, { total: number; passed: number; failed: number; totalCostUsd: number }>();
    for (const r of runs) {
      const e = cfgMap.get(r.agentConfigId) ?? { total: 0, passed: 0, failed: 0, totalCostUsd: 0 };
      e.total++; if (r.passed === true) e.passed++; if (r.passed === false) e.failed++;
      e.totalCostUsd += r.costUsd ?? 0; cfgMap.set(r.agentConfigId, e);
    }
    const byConfig = [...cfgMap.entries()].map(([agentConfigId, e]) => ({
      agentConfigId, total: e.total, passed: e.passed, failed: e.failed,
      solveRate: e.total > 0 ? e.passed / e.total : 0, avgCostUsd: e.total > 0 ? e.totalCostUsd / e.total : 0,
    })).sort((a, b) => b.solveRate - a.solveRate);
    const summary = {
      generatedAt: new Date().toISOString(),
      since: opts.since ?? null,
      totalRuns, passedRuns, failedRuns,
      solveRate: totalRuns > 0 ? passedRuns / totalRuns : 0,
      totalCostUsd, avgCostUsd: totalRuns > 0 ? totalCostUsd / totalRuns : 0,
      uniqueTestCases: tcMap.size, uniqueConfigs: cfgMap.size,
      byTestCase, byConfig,
    };
    writeExport(output, JSON.stringify(summary, null, 2));
    return;
  }

  throw new Error(`Unknown export subcommand "${subcommand}". Use "runs", "traces", or "summary".`);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function runsToCSV(
  rows: Array<{
    id: string;
    testCaseId: string;
    agentConfigId: string;
    status?: string;
    passed: boolean | null;
    costUsd: number | null;
    durationMs: number | null;
    stepsCount: number | null;
    tokensIn: number | null;
    tokensOut: number | null;
    error?: string | null;
    sandboxProvider?: string;
    createdAt?: number;
    matrixId: string | null | undefined;
    metrics: unknown;
  }>,
  columns?: string[],
): string {
  const allHeaders = ["id", "testCaseId", "agentConfigId", "passed", "costUsd", "durationMs", "stepsCount", "tokensIn", "tokensOut", "matrixId", "metrics"];
  const headers = columns && columns.length > 0 ? allHeaders.filter((h) => columns.includes(h)) : allHeaders;
  const lines = [headers.join(",")];
  for (const row of rows) {
    const allValues: Record<string, unknown> = {
      id: row.id,
      testCaseId: row.testCaseId,
      agentConfigId: row.agentConfigId,
      status: row.status ?? null,
      passed: row.passed,
      costUsd: row.costUsd,
      durationMs: row.durationMs,
      stepsCount: row.stepsCount,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      error: row.error ?? null,
      sandboxProvider: row.sandboxProvider ?? null,
      createdAt: row.createdAt ?? null,
      matrixId: row.matrixId ?? null,
      metrics: row.metrics,
    };
    lines.push(headers.map((h) => csvCell(allValues[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function writeExport(outputPath: string, content: string, count?: number) {
  const path = resolve(outputPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
  const countNote = count !== undefined ? ` (${count} record${count === 1 ? "" : "s"})` : "";
  console.log(`Export written to ${path}${countNote}`);
}

export async function maybeAutoExportOnBench(
  db: AgrDb,
  matrixId: string | undefined,
  runIds: string[],
): Promise<void> {
  if (process.env.AGR_EXPORT_ON_BENCH !== "true") return;
  const output = matrixId ? `.agr/exports/bench-${matrixId}.json` : `.agr/exports/bench-latest.json`;
  await exportCommand("runs", { format: "json", output, db: ".agr/db.sqlite", matrixId, limit: runIds.length });
}
