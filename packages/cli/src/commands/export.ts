import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { initDb, getTraces, listRuns, type AgrDb } from "@agentgrader/store";
import { tracesToOtelJson, tracesToOtelJsonl } from "../lib/export/otel";

export async function exportCommand(
  subcommand: string,
  opts: {
    format?: "json" | "jsonl" | "otlp";
    output?: string;
    db?: string;
    runId?: string;
    last?: boolean;
    matrixId?: string;
    limit?: number;
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
    if (opts.matrixId) runs = runs.filter((r) => r.matrixId === opts.matrixId);
    if (opts.limit) runs = runs.slice(0, opts.limit);
    const payload = runs.map((r) => ({
      id: r.id,
      testCaseId: r.testCaseId,
      agentConfigId: r.agentConfigId,
      passed: r.passed,
      costUsd: r.costUsd,
      durationMs: r.durationMs,
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
