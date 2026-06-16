import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { initDb, getTraces, listRuns, type AgrDb } from "@agentgrader/store";
import { tracesToOtelJson, tracesToOtelJsonl } from "../lib/export/otel";

function parseSince(since: string): number {
  const relative = since.match(/^(\d+)(s|m|h|d)$/);
  if (relative) {
    const n = parseInt(relative[1]!, 10);
    const unit = relative[2]!;
    const ms: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return Math.floor((Date.now() - n * ms[unit]!) / 1000);
  }
  const ts = Date.parse(since);
  if (isNaN(ts)) throw new Error(`--since: unrecognized format "${since}". Use ISO date or duration like 1h, 24h, 7d.`);
  return Math.floor(ts / 1000);
}

export async function exportCommand(
  subcommand: string,
  opts: {
    format?: "json" | "jsonl" | "otlp";
    output?: string;
    db?: string;
    runId?: string;
    last?: boolean;
    matrixId?: string;
    lastMatrix?: boolean;
    limit?: number;
    since?: string;
  },
) {
  const db = initDb(opts.db ?? ".agr/db.sqlite");
  const format = opts.format ?? "json";
  const output = opts.output ?? `export-${subcommand}.${format === "jsonl" ? "jsonl" : "json"}`;

  if (subcommand === "traces") {
    let resolvedRunId = opts.runId;
    if (opts.last) {
      const runs = await listRuns(db);
      if (runs.length === 0) {
        console.error("No runs found in .agr/db.sqlite. Run `agr run` or `agr bench` first.");
        process.exit(1);
      }
      resolvedRunId = runs[0]!.id;
    }
    if (!resolvedRunId) {
      console.error("--run-id is required for `agr export traces` (or use --last)");
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
    const content =
      format === "jsonl"
        ? `${payload.map((row) => JSON.stringify(row)).join("\n")}\n`
        : JSON.stringify(payload, null, 2);
    writeExport(output, content, payload.length);
    return;
  }

  throw new Error(`Unknown export subcommand "${subcommand}". Use "runs" or "traces".`);
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
