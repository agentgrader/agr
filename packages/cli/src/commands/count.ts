import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns, agentConfigs } from "@agentgrader/store";
import { parseSince } from "../lib/parse-since";

export async function countCommand(opts: {
  db?: string;
  since?: string;
  testCase?: string;
  config?: string;
  model?: string;
  sandbox?: string;
  passed?: boolean;
  matrixId?: string;
  lastMatrix?: boolean;
  json?: boolean;
}) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const resolvedPath = resolve(dbPath);

  if (!existsSync(resolvedPath)) {
    if (opts.json) {
      console.log(JSON.stringify({ total: 0, dbPath }));
    } else {
      console.log("0");
    }
    return;
  }

  const db = initDb(dbPath);
  let runs = await listRuns(db);

  let resolvedMatrixId = opts.matrixId;
  if (opts.lastMatrix && !resolvedMatrixId) {
    const mr = runs.find((r) => r.matrixId);
    resolvedMatrixId = mr?.matrixId ?? undefined;
  }
  if (resolvedMatrixId) runs = runs.filter((r) => r.matrixId === resolvedMatrixId);

  if (opts.since) {
    const sinceTs = parseSince(opts.since);
    runs = runs.filter((r) => r.createdAt >= sinceTs);
  }
  if (opts.testCase) {
    const tc = opts.testCase;
    runs = runs.filter((r) => r.testCaseId === tc || r.testCaseId.includes(tc));
  }
  if (opts.config) {
    const cfg = opts.config;
    runs = runs.filter((r) => r.agentConfigId === cfg || r.agentConfigId.includes(cfg));
  }
  if (opts.sandbox) {
    const sf = opts.sandbox.toLowerCase();
    runs = runs.filter((r) => (r.sandboxProvider ?? "").toLowerCase().includes(sf));
  }
  if (opts.model) {
    const cfgRows = await db.select().from(agentConfigs);
    const modelByConfigId = new Map(cfgRows.map((r) => [r.id, r.model ?? ""]));
    const mf = opts.model.toLowerCase();
    runs = runs.filter((r) => (modelByConfigId.get(r.agentConfigId) ?? "").toLowerCase().includes(mf));
  }
  if (opts.passed !== undefined) {
    runs = runs.filter((r) => r.passed === opts.passed);
  }

  const total = runs.length;
  const passed = runs.filter((r) => r.passed === true).length;
  const failed = runs.filter((r) => r.passed === false).length;

  if (opts.json) {
    console.log(JSON.stringify({ total, passed, failed, dbPath }));
  } else {
    console.log(String(total));
  }
}
