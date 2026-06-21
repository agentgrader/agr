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
  byTestCase?: boolean;
  byConfig?: boolean;
  errored?: boolean;
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
  if (opts.errored) {
    runs = runs.filter((r) => r.status === "failed" && r.passed == null);
  } else if (opts.passed !== undefined) {
    runs = runs.filter((r) => r.passed === opts.passed);
  }

  if (opts.byTestCase) {
    const tcMap = new Map<string, { total: number; passed: number; failed: number }>();
    for (const r of runs) {
      const entry = tcMap.get(r.testCaseId) ?? { total: 0, passed: 0, failed: 0 };
      entry.total++;
      if (r.passed === true) entry.passed++;
      if (r.passed === false) entry.failed++;
      tcMap.set(r.testCaseId, entry);
    }
    const byTestCase = [...tcMap.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([testCaseId, c]) => ({ testCaseId, ...c, solveRate: c.total > 0 ? (c.passed / c.total) * 100 : 0 }));
    if (opts.json) {
      console.log(JSON.stringify({ total: runs.length, dbPath, byTestCase }));
    } else {
      for (const tc of byTestCase) {
        const srNote = tc.total > 0 && (tc.passed > 0 || tc.failed > 0) ? `  ${tc.solveRate.toFixed(0)}%` : "";
        console.log(`${tc.total}\t${tc.testCaseId}\t(${tc.passed} passed, ${tc.failed} failed)${srNote}`);
      }
    }
    return;
  }

  if (opts.byConfig) {
    const cfgMap = new Map<string, { total: number; passed: number; failed: number }>();
    for (const r of runs) {
      const entry = cfgMap.get(r.agentConfigId) ?? { total: 0, passed: 0, failed: 0 };
      entry.total++;
      if (r.passed === true) entry.passed++;
      if (r.passed === false) entry.failed++;
      cfgMap.set(r.agentConfigId, entry);
    }
    const byConfig = [...cfgMap.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([agentConfigId, c]) => ({ agentConfigId, ...c, solveRate: c.total > 0 ? (c.passed / c.total) * 100 : 0 }));
    if (opts.json) {
      console.log(JSON.stringify({ total: runs.length, dbPath, byConfig }));
    } else {
      for (const cfg of byConfig) {
        const srNote = cfg.total > 0 && (cfg.passed > 0 || cfg.failed > 0) ? `  ${cfg.solveRate.toFixed(0)}%` : "";
        console.log(`${cfg.total}\t${cfg.agentConfigId}\t(${cfg.passed} passed, ${cfg.failed} failed)${srNote}`);
      }
    }
    return;
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
