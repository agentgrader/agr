import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns, agentConfigs } from "@agentgrader/store";
import { parseSince } from "../lib/parse-since";

export async function costCommand(opts: {
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
  byModel?: boolean;
}) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const resolvedPath = resolve(dbPath);

  if (!existsSync(resolvedPath)) {
    if (opts.json) {
      console.log(JSON.stringify({ totalCostUsd: 0, avgCostUsd: 0, total: 0, dbPath }));
    } else {
      console.log("$0.0000");
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

  if (opts.byTestCase) {
    const tcMap = new Map<string, { total: number; totalCostUsd: number }>();
    for (const r of runs) {
      const entry = tcMap.get(r.testCaseId) ?? { total: 0, totalCostUsd: 0 };
      entry.total++;
      entry.totalCostUsd += r.costUsd ?? 0;
      tcMap.set(r.testCaseId, entry);
    }
    const byTestCase = [...tcMap.entries()]
      .map(([testCaseId, e]) => ({ testCaseId, total: e.total, totalCostUsd: e.totalCostUsd, avgCostUsd: e.totalCostUsd / e.total }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
    if (opts.json) {
      console.log(JSON.stringify({ total: runs.length, totalCostUsd: runs.reduce((s, r) => s + (r.costUsd ?? 0), 0), dbPath, byTestCase }));
    } else {
      for (const tc of byTestCase) {
        console.log(`$${tc.totalCostUsd.toFixed(4)}\t${tc.testCaseId}\t(${tc.total} runs, avg $${tc.avgCostUsd.toFixed(4)}/run)`);
      }
    }
    return;
  }

  if (opts.byConfig) {
    const cfgMap = new Map<string, { total: number; totalCostUsd: number }>();
    for (const r of runs) {
      const entry = cfgMap.get(r.agentConfigId) ?? { total: 0, totalCostUsd: 0 };
      entry.total++;
      entry.totalCostUsd += r.costUsd ?? 0;
      cfgMap.set(r.agentConfigId, entry);
    }
    const byConfig = [...cfgMap.entries()]
      .map(([agentConfigId, e]) => ({ agentConfigId, total: e.total, totalCostUsd: e.totalCostUsd, avgCostUsd: e.totalCostUsd / e.total }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
    if (opts.json) {
      console.log(JSON.stringify({ total: runs.length, totalCostUsd: runs.reduce((s, r) => s + (r.costUsd ?? 0), 0), dbPath, byConfig }));
    } else {
      for (const cfg of byConfig) {
        console.log(`$${cfg.totalCostUsd.toFixed(4)}\t${cfg.agentConfigId}\t(${cfg.total} runs, avg $${cfg.avgCostUsd.toFixed(4)}/run)`);
      }
    }
    return;
  }

  if (opts.byModel) {
    const cfgRows = await db.select().from(agentConfigs);
    const modelByConfigId = new Map(cfgRows.map((r) => [r.id, r.model ?? "unknown"]));
    const modelMap = new Map<string, { total: number; totalCostUsd: number }>();
    for (const r of runs) {
      const model = modelByConfigId.get(r.agentConfigId) ?? "unknown";
      const entry = modelMap.get(model) ?? { total: 0, totalCostUsd: 0 };
      entry.total++;
      entry.totalCostUsd += r.costUsd ?? 0;
      modelMap.set(model, entry);
    }
    const byModel = [...modelMap.entries()]
      .map(([model, e]) => ({ model, total: e.total, totalCostUsd: e.totalCostUsd, avgCostUsd: e.totalCostUsd / e.total }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
    if (opts.json) {
      console.log(JSON.stringify({ total: runs.length, totalCostUsd: runs.reduce((s, r) => s + (r.costUsd ?? 0), 0), dbPath, byModel }));
    } else {
      for (const m of byModel) {
        console.log(`$${m.totalCostUsd.toFixed(4)}\t${m.model}\t(${m.total} runs, avg $${m.avgCostUsd.toFixed(4)}/run)`);
      }
    }
    return;
  }

  const total = runs.length;
  const totalCostUsd = runs.reduce((acc, r) => acc + (r.costUsd ?? 0), 0);
  const avgCostUsd = total > 0 ? totalCostUsd / total : 0;

  if (opts.json) {
    console.log(JSON.stringify({ totalCostUsd, avgCostUsd, total, dbPath }));
  } else {
    console.log(`$${totalCostUsd.toFixed(4)}`);
  }
}
