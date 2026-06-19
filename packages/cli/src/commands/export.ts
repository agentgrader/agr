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
  },
) {
  const db = initDb(opts.db ?? ".agr/db.sqlite");
  const format = opts.format ?? "json";
  const ext = format === "jsonl" ? "jsonl" : format === "csv" ? "csv" : "json";
  const output = opts.output ?? `export-${subcommand}.${ext}`;

  if (subcommand === "traces") {
    const hasFilters = opts.testCase || opts.config || opts.since || opts.passed !== undefined;
    const hasRunSelector = opts.runId || opts.last;

    if (!hasRunSelector && !hasFilters) {
      console.error("--run-id is required for `agr export traces` (or use --last, --test-case, or --config)");
      process.exit(1);
    }

    if (hasFilters && !hasRunSelector) {
      // Multi-run trace export filtered by test case / config / since / passed / limit
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
    const payload = runs.map((r) => ({
      id: r.id,
      testCaseId: r.testCaseId,
      agentConfigId: r.agentConfigId,
      passed: r.passed,
      costUsd: r.costUsd,
      durationMs: r.durationMs,
      stepsCount: r.stepsCount,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      matrixId: r.matrixId,
      metrics: r.metrics ? JSON.parse(r.metrics) : null,
    }));
    let content: string;
    if (format === "jsonl") {
      content = `${payload.map((row) => JSON.stringify(row)).join("\n")}\n`;
    } else if (format === "csv") {
      content = runsToCSV(payload);
    } else {
      content = JSON.stringify(payload, null, 2);
    }
    writeExport(output, content, payload.length);
    return;
  }

  throw new Error(`Unknown export subcommand "${subcommand}". Use "runs" or "traces".`);
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
    passed: boolean | null;
    costUsd: number | null;
    durationMs: number | null;
    stepsCount: number | null;
    tokensIn: number | null;
    tokensOut: number | null;
    matrixId: string | null | undefined;
    metrics: unknown;
  }>,
): string {
  const headers = [
    "id",
    "testCaseId",
    "agentConfigId",
    "passed",
    "costUsd",
    "durationMs",
    "stepsCount",
    "tokensIn",
    "tokensOut",
    "matrixId",
    "metrics",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.testCaseId,
        row.agentConfigId,
        row.passed,
        row.costUsd,
        row.durationMs,
        row.stepsCount,
        row.tokensIn,
        row.tokensOut,
        row.matrixId ?? null,
        row.metrics,
      ]
        .map(csvCell)
        .join(","),
    );
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
