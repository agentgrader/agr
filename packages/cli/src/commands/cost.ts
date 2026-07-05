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
  bySandbox?: boolean;
  total?: boolean;
  avg?: boolean;
  percentiles?: boolean;
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

  if (opts.bySandbox) {
    const sbMap = new Map<string, { total: number; totalCostUsd: number }>();
    for (const r of runs) {
      const key = r.sandboxProvider ?? "unknown";
      const entry = sbMap.get(key) ?? { total: 0, totalCostUsd: 0 };
      entry.total++;
      entry.totalCostUsd += r.costUsd ?? 0;
      sbMap.set(key, entry);
    }
    const bySandbox = [...sbMap.entries()]
      .map(([sandbox, e]) => ({ sandbox, total: e.total, totalCostUsd: e.totalCostUsd, avgCostUsd: e.totalCostUsd / e.total }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
    if (opts.json) {
      console.log(JSON.stringify({ total: runs.length, totalCostUsd: runs.reduce((s, r) => s + (r.costUsd ?? 0), 0), dbPath, bySandbox }));
    } else {
      for (const sb of bySandbox) {
        console.log(`$${sb.totalCostUsd.toFixed(4)}\t${sb.sandbox}\t(${sb.total} runs, avg $${sb.avgCostUsd.toFixed(4)}/run)`);
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

  if (opts.percentiles) {
    const costs = runs.map((r) => r.costUsd ?? 0).sort((a, b) => a - b);
    const pct = (p: number) => {
      if (costs.length === 0) return 0;
      const idx = Math.ceil((p / 100) * costs.length) - 1;
      return costs[Math.max(0, Math.min(idx, costs.length - 1))]!;
    };
    const p50 = pct(50); const p90 = pct(90); const p95 = pct(95); const p99 = pct(99);
    const totalCostUsd2 = costs.reduce((s, c) => s + c, 0);
    if (opts.json) {
      console.log(JSON.stringify({ total: costs.length, totalCostUsd: totalCostUsd2, p50, p90, p95, p99, min: costs[0] ?? 0, max: costs[costs.length - 1] ?? 0, dbPath }));
    } else {
      console.log(`Cost percentiles (${costs.length} runs):`);
      console.log(`  p50: $${p50.toFixed(4)}`);
      console.log(`  p90: $${p90.toFixed(4)}`);
      console.log(`  p95: $${p95.toFixed(4)}`);
      console.log(`  p99: $${p99.toFixed(4)}`);
      console.log(`  min: $${(costs[0] ?? 0).toFixed(4)}  max: $${(costs[costs.length - 1] ?? 0).toFixed(4)}`);
    }
    return;
  }

  if (opts.total) {
    console.log(totalCostUsd.toFixed(4));
    return;
  }
  if (opts.avg) {
    console.log(avgCostUsd.toFixed(4));
    return;
  }
  if (opts.json) {
    console.log(JSON.stringify({ totalCostUsd, avgCostUsd, total, dbPath }));
  } else {
    console.log(`$${totalCostUsd.toFixed(4)}`);
  }
}
