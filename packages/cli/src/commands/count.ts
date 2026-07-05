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
  byModel?: boolean;
  errored?: boolean;
  regression?: boolean;
  regressionWindow?: number;
  active?: boolean;
  bySandbox?: boolean;
  byDay?: number;
  byWeek?: number;
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

  if (opts.byModel) {
    const cfgRows = await db.select().from(agentConfigs);
    const modelByConfigId = new Map(cfgRows.map((r) => [r.id, r.model ?? "unknown"]));
    const modelMap = new Map<string, { total: number; passed: number; failed: number }>();
    for (const r of runs) {
      const model = modelByConfigId.get(r.agentConfigId) ?? "unknown";
      const entry = modelMap.get(model) ?? { total: 0, passed: 0, failed: 0 };
      entry.total++;
      if (r.passed === true) entry.passed++;
      if (r.passed === false) entry.failed++;
      modelMap.set(model, entry);
    }
    const byModel = [...modelMap.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([model, c]) => ({ model, ...c, solveRate: c.total > 0 ? (c.passed / c.total) * 100 : 0 }));
    if (opts.json) {
      console.log(JSON.stringify({ total: runs.length, dbPath, byModel }));
    } else {
      for (const m of byModel) {
        const srNote = m.total > 0 && (m.passed > 0 || m.failed > 0) ? `  ${m.solveRate.toFixed(0)}%` : "";
        console.log(`${m.total}\t${m.model}\t(${m.passed} passed, ${m.failed} failed)${srNote}`);
      }
    }
    return;
  }

  if (opts.regression) {
    const window = opts.regressionWindow ?? 3;
    const allRuns = await listRuns(db);
    const tcMap = new Map<string, typeof allRuns>();
    for (const r of allRuns) {
      if (!tcMap.has(r.testCaseId)) tcMap.set(r.testCaseId, []);
      tcMap.get(r.testCaseId)!.push(r);
    }
    let regressionCount = 0;
    for (const tcRuns of tcMap.values()) {
      const recent = tcRuns.slice(0, window);
      if (recent.length >= window && recent.every((r) => r.passed === false) && tcRuns.some((r) => r.passed === true)) {
        regressionCount++;
      }
    }
    if (opts.json) {
      console.log(JSON.stringify({ regressions: regressionCount, regressionWindow: window, dbPath }));
    } else {
      console.log(String(regressionCount));
    }
    return;
  }

  if (opts.active) {
    const activeRuns = runs.filter((r) => r.status === "running");
    if (opts.json) {
      console.log(JSON.stringify({ active: activeRuns.length, dbPath }));
    } else {
      console.log(activeRuns.length);
    }
    return;
  }

  if (opts.byWeek !== undefined) {
    const weeks = opts.byWeek > 0 ? opts.byWeek : 4;
    const now = Math.floor(Date.now() / 1000);
    const result: Array<{ week: string; count: number; passed: number; failed: number }> = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = now - (i + 1) * 7 * 86400;
      const weekEnd = now - i * 7 * 86400;
      const weekRuns = runs.filter((r) => r.createdAt >= weekStart && r.createdAt < weekEnd);
      const weekLabel = new Date(weekStart * 1000).toISOString().slice(0, 10);
      result.push({ week: weekLabel, count: weekRuns.length, passed: weekRuns.filter((r) => r.passed === true).length, failed: weekRuns.filter((r) => r.passed === false).length });
    }
    if (opts.json) {
      console.log(JSON.stringify({ weeks, dbPath, byWeek: result }));
    } else {
      for (const w of result) console.log(`${w.week}\t${w.count}\t(${w.passed} passed, ${w.failed} failed)`);
    }
    return;
  }

  if (opts.byDay !== undefined) {
    const days = opts.byDay > 0 ? opts.byDay : 7;
    const now = Math.floor(Date.now() / 1000);
    const result: Array<{ date: string; count: number; passed: number; failed: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (i + 1) * 86400;
      const dayEnd = now - i * 86400;
      const dayRuns = runs.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd);
      const date = new Date(dayStart * 1000).toISOString().slice(0, 10);
      result.push({ date, count: dayRuns.length, passed: dayRuns.filter((r) => r.passed === true).length, failed: dayRuns.filter((r) => r.passed === false).length });
    }
    if (opts.json) {
      console.log(JSON.stringify({ days, dbPath, byDay: result }));
    } else {
      for (const d of result) console.log(`${d.date}\t${d.count}\t(${d.passed} passed, ${d.failed} failed)`);
    }
    return;
  }

  if (opts.bySandbox) {
    const sbMap = new Map<string, number>();
    for (const r of runs) {
      const key = r.sandboxProvider ?? "unknown";
      sbMap.set(key, (sbMap.get(key) ?? 0) + 1);
    }
    const bySandbox = [...sbMap.entries()].map(([sandbox, count]) => ({ sandbox, count })).sort((a, b) => b.count - a.count);
    if (opts.json) {
      console.log(JSON.stringify({ total: runs.length, bySandbox, dbPath }));
    } else {
      for (const e of bySandbox) console.log(`${e.count}\t${e.sandbox}`);
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
