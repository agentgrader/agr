import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns, agentConfigs } from "@agentgrader/store";
import { formatCompactWhen, formatDuration } from "../lib/format-relative-time";
import { parseSince } from "../lib/parse-since";

/**
 * `agr status [--db <path>] [--json]`
 *
 * Prints a quick summary of the local run database without launching the
 * interactive TUI. Useful for a health-check in scripts or shell prompts
 * and as a complement to `agr list --plain` when you only need counts.
 * Pass `--json` for machine-readable output.
 */
type StatusSortField = "solve-rate" | "cost" | "runs";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}

export async function statusCommand(opts: { db?: string; json?: boolean; since?: string; testCase?: string; config?: string; model?: string; sandbox?: string; passed?: boolean; byConfig?: boolean; byTestCase?: boolean; byModel?: boolean; bySandbox?: boolean; byMatrix?: boolean; top?: number; matrixId?: string; lastMatrix?: boolean; trend?: boolean; byDay?: boolean; sortBy?: StatusSortField; errors?: boolean; flaky?: boolean; percentiles?: boolean; below?: number; above?: number; grid?: boolean; minRuns?: number; rolling?: number; showIds?: boolean; solveRate?: boolean }) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const resolvedPath = resolve(dbPath);

  if (!existsSync(resolvedPath)) {
    if (opts.json) {
      console.log(JSON.stringify({ exists: false, dbPath }));
    } else {
      console.log(`No database at ${dbPath}.`);
      console.log("Run `agr run` or `agr bench` first to start recording runs.");
    }
    return;
  }

  const db = initDb(dbPath);
  let runs = await listRuns(db);
  let sinceLabel: string | undefined;

  if (opts.lastMatrix && !opts.matrixId) {
    const mr = runs.find((r) => r.matrixId);
    if (mr?.matrixId) runs = runs.filter((r) => r.matrixId === mr.matrixId);
  } else if (opts.matrixId) {
    runs = runs.filter((r) => r.matrixId === opts.matrixId);
  }

  if (opts.since) {
    const sinceTs = parseSince(opts.since);
    sinceLabel = `${opts.since} (since ${new Date(sinceTs * 1000).toISOString()})`;
    runs = runs.filter((r) => r.createdAt >= sinceTs);
  }

  if (opts.testCase) {
    runs = runs.filter((r) => r.testCaseId === opts.testCase || r.testCaseId.includes(opts.testCase!));
  }
  if (opts.config) {
    runs = runs.filter((r) => r.agentConfigId === opts.config || r.agentConfigId.includes(opts.config!));
  }
  if (opts.model) {
    const cfgRows = await db.select().from(agentConfigs);
    const modelByConfigId = new Map(cfgRows.map((r) => [r.id, r.model ?? ""]));
    const mf = opts.model.toLowerCase();
    runs = runs.filter((r) => (modelByConfigId.get(r.agentConfigId) ?? "").toLowerCase().includes(mf));
  }
  if (opts.sandbox) {
    const sf = opts.sandbox.toLowerCase();
    runs = runs.filter((r) => (r.sandboxProvider ?? "").toLowerCase().includes(sf));
  }
  if (opts.passed !== undefined) {
    runs = runs.filter((r) => r.passed === opts.passed);
  }

  if (runs.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, totalRuns: 0 }));
    } else {
      console.log(`Database: ${dbPath}\n`);
      console.log("No runs recorded yet. Run `agr run` or `agr bench` to get started.");
    }
    return;
  }

  const passedRuns = runs.filter((r) => r.passed === true).length;
  const failedRuns = runs.filter((r) => r.passed === false).length;
  const erroredRuns = runs.filter((r) => r.status === "failed" && r.passed == null).length;
  const totalCostUsd = runs.reduce((acc, r) => acc + (r.costUsd ?? 0), 0);
  const totalTokensIn = runs.reduce((acc, r) => acc + (r.tokensIn ?? 0), 0);
  const totalTokensOut = runs.reduce((acc, r) => acc + (r.tokensOut ?? 0), 0);
  const uniqueTestCases = new Set(runs.map((r) => r.testCaseId)).size;
  const uniqueConfigs = new Set(runs.map((r) => r.agentConfigId)).size;
  const lastRun = runs[0];
  const matrixRuns = runs.filter((r) => r.matrixId).length;
  const avgCostUsd = runs.length > 0 ? totalCostUsd / runs.length : 0;
  const avgDurationMs = runs.length > 0
    ? runs.reduce((acc, r) => acc + (r.durationMs ?? 0), 0) / runs.length
    : 0;
  const solveRate = runs.length > 0 ? (passedRuns / runs.length) * 100 : 0;
  const sortedCosts = [...runs.map((r) => r.costUsd ?? 0)].sort((a, b) => a - b);
  const sortedDurations = [...runs.map((r) => r.durationMs ?? 0)].sort((a, b) => a - b);
  const p50CostUsd = percentile(sortedCosts, 50);
  const p95CostUsd = percentile(sortedCosts, 95);
  const p50DurationMs = percentile(sortedDurations, 50);
  const p95DurationMs = percentile(sortedDurations, 95);

  if (opts.solveRate) {
    if (opts.json) {
      console.log(JSON.stringify({ solveRate, passedRuns, failedRuns, totalRuns: runs.length, dbPath }));
    } else {
      console.log(solveRate.toFixed(1));
    }
    return;
  }

  if (opts.trend && opts.since && !opts.byConfig && !opts.byTestCase && !opts.byModel && !opts.bySandbox && !opts.byMatrix) {
    const sinceTs = parseSince(opts.since);
    const nowTs = Math.floor(Date.now() / 1000);
    const windowSec = nowTs - sinceTs;
    const prevStart = sinceTs - windowSec;
    let prevRuns = (await listRuns(db)).filter((r) => r.createdAt >= prevStart && r.createdAt < sinceTs);
    if (opts.testCase) prevRuns = prevRuns.filter((r) => r.testCaseId === opts.testCase || r.testCaseId.includes(opts.testCase!));
    if (opts.config) prevRuns = prevRuns.filter((r) => r.agentConfigId === opts.config || r.agentConfigId.includes(opts.config!));
    if (opts.sandbox) prevRuns = prevRuns.filter((r) => (r.sandboxProvider ?? "").toLowerCase().includes(opts.sandbox!.toLowerCase()));
    if (opts.passed !== undefined) prevRuns = prevRuns.filter((r) => r.passed === opts.passed);

    const prevPassed = prevRuns.filter((r) => r.passed === true).length;
    const prevSolveRate = prevRuns.length > 0 ? (prevPassed / prevRuns.length) * 100 : 0;
    const prevCostUsd = prevRuns.reduce((acc, r) => acc + (r.costUsd ?? 0), 0);
    const prevAvgCost = prevRuns.length > 0 ? prevCostUsd / prevRuns.length : 0;

    const solveRateDelta = solveRate - prevSolveRate;
    const avgCostDelta = avgCostUsd - prevAvgCost;
    const runsDelta = runs.length - prevRuns.length;

    function arrow(delta: number): string { return delta > 0 ? "↑" : delta < 0 ? "↓" : "="; }
    function sign(v: number, decimals = 1): string { return v > 0 ? `+${v.toFixed(decimals)}` : v.toFixed(decimals); }

    if (opts.json) {
      const trend = {
        window: opts.since,
        current: { total: runs.length, passed: passedRuns, solveRate, avgCostUsd },
        previous: { total: prevRuns.length, passed: prevPassed, solveRate: prevSolveRate, avgCostUsd: prevAvgCost },
        delta: { runs: runsDelta, solveRatePp: solveRateDelta, avgCostUsd: avgCostDelta },
      };
      console.log(JSON.stringify({ exists: true, dbPath, trend }, null, 2));
      return;
    }

    console.log(`Database: ${dbPath}\n`);
    console.log(`Trend: last ${opts.since} vs previous ${opts.since}\n`);
    console.log(`  Solve rate:  ${prevSolveRate.toFixed(1)}% -> ${solveRate.toFixed(1)}%  (${sign(solveRateDelta)}pp) ${arrow(solveRateDelta)}`);
    console.log(`  Runs:        ${prevRuns.length} -> ${runs.length}  (${sign(runsDelta, 0)})`);
    console.log(`  Avg cost:    $${prevAvgCost.toFixed(4)} -> $${avgCostUsd.toFixed(4)}/run  (${sign(avgCostDelta * 100, 2)}c) ${arrow(-avgCostDelta)}`);
    console.log("");
    console.log(`Next: agr status --since ${opts.since} --by-config  |  agr status --since ${opts.since} --by-model`);
    return;
  }

  if (opts.byDay) {
    const dayMap = new Map<string, typeof runs>();
    for (const run of runs) {
      const day = new Date(run.createdAt * 1000).toISOString().slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(run);
    }
    const dayStats = Array.from(dayMap.entries()).map(([day, dRuns]) => {
      const p = dRuns.filter((r) => r.passed === true).length;
      const f = dRuns.filter((r) => r.passed === false).length;
      const cost = dRuns.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      return {
        day,
        total: dRuns.length,
        passed: p,
        failed: f,
        solveRate: dRuns.length > 0 ? (p / dRuns.length) * 100 : 0,
        totalCostUsd: cost,
        avgCostUsd: dRuns.length > 0 ? cost / dRuns.length : 0,
      };
    }).sort((a, b) => a.day.localeCompare(b.day));
    const dayStatsCapped = opts.top ? dayStats.slice(-opts.top) : dayStats;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, byDay: dayStatsCapped }, null, 2));
      return;
    }

    const topNote = opts.top && opts.top < dayStats.length ? ` (last ${opts.top} of ${dayStats.length} days)` : "";
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}\n`);
    console.log(`Per-day breakdown (${dayStatsCapped.length} day(s)${topNote}, oldest first):\n`);
    for (const ds of dayStatsCapped) {
      const solveStr = ds.total > 0 && (ds.passed > 0 || ds.failed > 0) ? `  solve: ${ds.solveRate.toFixed(1)}%` : "";
      console.log(`  ${ds.day}  runs: ${ds.total} (${ds.passed} passed, ${ds.failed} failed)${solveStr}  cost: $${ds.totalCostUsd.toFixed(4)}`);
    }
    console.log(`\nNext: agr status --since 7d --trend  |  agr export runs --since 7d --format csv --output week.csv`);
    return;
  }

  if (opts.byMatrix) {
    const allMatrixRuns = runs.filter((r) => r.matrixId);
    if (allMatrixRuns.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify({ exists: true, dbPath, byMatrix: [] }, null, 2));
      } else {
        console.log(`Database: ${dbPath}\n`);
        console.log("No matrix runs found. Run `agr bench --matrix` first.");
      }
      return;
    }
    const matrixMap = new Map<string, typeof allMatrixRuns>();
    for (const run of allMatrixRuns) {
      const key = run.matrixId!;
      if (!matrixMap.has(key)) matrixMap.set(key, []);
      matrixMap.get(key)!.push(run);
    }
    const matrixStats = Array.from(matrixMap.entries()).map(([matrixId, mRuns]) => {
      const p = mRuns.filter((r) => r.passed === true).length;
      const f = mRuns.filter((r) => r.passed === false).length;
      const cost = mRuns.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      const dur = mRuns.reduce((s, r) => s + (r.durationMs ?? 0), 0);
      const earliest = mRuns.reduce((min, r) => Math.min(min, r.createdAt), Infinity);
      return {
        matrixId,
        total: mRuns.length,
        passed: p,
        failed: f,
        solveRate: mRuns.length > 0 ? (p / mRuns.length) * 100 : 0,
        avgCostUsd: mRuns.length > 0 ? cost / mRuns.length : 0,
        avgDurationMs: mRuns.length > 0 ? dur / mRuns.length : 0,
        startedAt: earliest,
      };
    }).sort((a, b) => b.startedAt - a.startedAt);
    const matrixStatsCapped = opts.top ? matrixStats.slice(0, opts.top) : matrixStats;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, byMatrix: matrixStatsCapped }, null, 2));
      return;
    }

    const topNote = opts.top && opts.top < matrixStats.length ? ` (top ${opts.top} of ${matrixStats.length})` : "";
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}\n`);
    console.log(`Per-matrix breakdown (${matrixStatsCapped.length} sweep(s)${topNote}, newest first):\n`);
    for (const ms of matrixStatsCapped) {
      const date = new Date(ms.startedAt * 1000).toISOString().slice(0, 16).replace("T", " ");
      console.log(`  ${ms.matrixId.slice(0, 8)}  ${date}`);
      console.log(`    runs: ${ms.total}  (${ms.passed} passed, ${ms.failed} failed)  solve rate: ${ms.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${ms.avgCostUsd.toFixed(4)}/run  avg duration: ${formatDuration(ms.avgDurationMs)}`);
    }
    console.log(`\nNext: agr list --matrix-id <id>  |  agr status --last-matrix --by-model`);
    return;
  }

  if (opts.byModel) {
    const cfgRows = await db.select().from(agentConfigs);
    const modelByConfigId = new Map(cfgRows.map((r) => [r.id, r.model ?? "unknown"]));
    const modelMap = new Map<string, typeof runs>();
    for (const run of runs) {
      const key = modelByConfigId.get(run.agentConfigId) ?? "unknown";
      if (!modelMap.has(key)) modelMap.set(key, []);
      modelMap.get(key)!.push(run);
    }
    const modelStats = Array.from(modelMap.entries()).map(([model, allMRuns]) => {
      const mRuns = opts.rolling ? allMRuns.slice(0, opts.rolling) : allMRuns;
      const p = mRuns.filter((r) => r.passed === true).length;
      const f = mRuns.filter((r) => r.passed === false).length;
      const cost = mRuns.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      const dur = mRuns.reduce((s, r) => s + (r.durationMs ?? 0), 0);
      const ti = mRuns.reduce((s, r) => s + (r.tokensIn ?? 0), 0);
      const to = mRuns.reduce((s, r) => s + (r.tokensOut ?? 0), 0);
      return {
        model,
        total: mRuns.length,
        passed: p,
        failed: f,
        solveRate: mRuns.length > 0 ? (p / mRuns.length) * 100 : 0,
        avgCostUsd: mRuns.length > 0 ? cost / mRuns.length : 0,
        avgDurationMs: mRuns.length > 0 ? dur / mRuns.length : 0,
        avgTokensIn: mRuns.length > 0 ? ti / mRuns.length : 0,
        avgTokensOut: mRuns.length > 0 ? to / mRuns.length : 0,
        lastRunId: allMRuns[0]?.id ?? null,
      };
    }).sort((a, b) => opts.sortBy === "cost" ? b.avgCostUsd - a.avgCostUsd : opts.sortBy === "runs" ? b.total - a.total : b.solveRate - a.solveRate);
    const modelStatsFiltered = modelStats
      .filter((s) => opts.minRuns === undefined || s.total >= opts.minRuns)
      .filter((s) => opts.below === undefined || s.solveRate < opts.below!)
      .filter((s) => opts.above === undefined || s.solveRate > opts.above!);
    const modelStatsCapped = opts.top ? modelStatsFiltered.slice(0, opts.top) : modelStatsFiltered;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, testCase: opts.testCase ?? null, config: opts.config ?? null, byModel: modelStatsCapped }, null, 2));
      return;
    }

    const topNote = opts.top && opts.top < modelStats.length ? ` (top ${opts.top} of ${modelStats.length})` : "";
    const tcScope = opts.testCase ? `  [test case: ${opts.testCase}]` : "";
    const cfgScope = opts.config ? `  [config: ${opts.config}]` : "";
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}${tcScope}${cfgScope}\n`);
    const modelSortLabel = opts.sortBy === "cost" ? "most expensive first" : opts.sortBy === "runs" ? "most runs first" : "solve rate desc";
    console.log(`Per-model breakdown (${modelStatsCapped.length} model(s)${topNote}, ${modelSortLabel}):\n`);
    for (const ms of modelStatsCapped) {
      const hasTokens = ms.avgTokensIn > 0 || ms.avgTokensOut > 0;
      const tokLine = hasTokens ? `  avg tok: ${Math.round(ms.avgTokensIn)}in/${Math.round(ms.avgTokensOut)}out` : "";
      console.log(`  ${ms.model}`);
      console.log(`    runs: ${ms.total}  (${ms.passed} passed, ${ms.failed} failed)  solve rate: ${ms.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${ms.avgCostUsd.toFixed(4)}/run  avg duration: ${formatDuration(ms.avgDurationMs)}${tokLine}`);
      if (opts.showIds && ms.lastRunId) console.log(`    last run: agr trace ${ms.lastRunId}`);
    }
    console.log(`\nNext: agr status --model <name>  |  agr bench --suite tasks/ --model <name>`);
    return;
  }

  if (opts.bySandbox) {
    const sandboxMap = new Map<string, typeof runs>();
    for (const run of runs) {
      const key = run.sandboxProvider ?? "unknown";
      if (!sandboxMap.has(key)) sandboxMap.set(key, []);
      sandboxMap.get(key)!.push(run);
    }
    const sandboxStats = Array.from(sandboxMap.entries()).map(([sandbox, sRuns]) => {
      const p = sRuns.filter((r) => r.passed === true).length;
      const f = sRuns.filter((r) => r.passed === false).length;
      const cost = sRuns.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      const dur = sRuns.reduce((s, r) => s + (r.durationMs ?? 0), 0);
      return {
        sandbox,
        total: sRuns.length,
        passed: p,
        failed: f,
        solveRate: sRuns.length > 0 ? (p / sRuns.length) * 100 : 0,
        avgCostUsd: sRuns.length > 0 ? cost / sRuns.length : 0,
        avgDurationMs: sRuns.length > 0 ? dur / sRuns.length : 0,
      };
    }).sort((a, b) => b.solveRate - a.solveRate);
    const sandboxStatsCapped = opts.top ? sandboxStats.slice(0, opts.top) : sandboxStats;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, bySandbox: sandboxStatsCapped }, null, 2));
      return;
    }

    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}\n`);
    console.log(`Per-sandbox breakdown (${sandboxStatsCapped.length} sandbox(es), sorted by solve rate):\n`);
    for (const ss of sandboxStatsCapped) {
      console.log(`  ${ss.sandbox}`);
      console.log(`    runs: ${ss.total}  (${ss.passed} passed, ${ss.failed} failed)  solve rate: ${ss.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${ss.avgCostUsd.toFixed(4)}/run  avg duration: ${formatDuration(ss.avgDurationMs)}`);
    }
    console.log(`\nNext: agr bench --sandbox e2b  |  agr bench --sandbox docker`);
    return;
  }

  if (opts.byConfig) {
    const cfgMap = new Map<string, typeof runs>();
    for (const run of runs) {
      const key = run.agentConfigId;
      if (!cfgMap.has(key)) cfgMap.set(key, []);
      cfgMap.get(key)!.push(run);
    }
    const cfgStats = Array.from(cfgMap.entries()).map(([configId, allCfgRuns]) => {
      const cfgRuns = opts.rolling ? allCfgRuns.slice(0, opts.rolling) : allCfgRuns;
      const p = cfgRuns.filter((r) => r.passed === true).length;
      const f = cfgRuns.filter((r) => r.passed === false).length;
      const cost = cfgRuns.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      const dur = cfgRuns.reduce((s, r) => s + (r.durationMs ?? 0), 0);
      const ti = cfgRuns.reduce((s, r) => s + (r.tokensIn ?? 0), 0);
      const to = cfgRuns.reduce((s, r) => s + (r.tokensOut ?? 0), 0);
      return {
        configId,
        total: cfgRuns.length,
        passed: p,
        failed: f,
        solveRate: cfgRuns.length > 0 ? (p / cfgRuns.length) * 100 : 0,
        avgCostUsd: cfgRuns.length > 0 ? cost / cfgRuns.length : 0,
        avgDurationMs: cfgRuns.length > 0 ? dur / cfgRuns.length : 0,
        avgTokensIn: cfgRuns.length > 0 ? ti / cfgRuns.length : 0,
        avgTokensOut: cfgRuns.length > 0 ? to / cfgRuns.length : 0,
        lastRunId: allCfgRuns[0]?.id ?? null,
      };
    }).sort((a, b) => opts.sortBy === "cost" ? b.avgCostUsd - a.avgCostUsd : opts.sortBy === "runs" ? b.total - a.total : b.solveRate - a.solveRate);
    const cfgStatsFiltered = cfgStats
      .filter((s) => opts.minRuns === undefined || s.total >= opts.minRuns)
      .filter((s) => opts.below === undefined || s.solveRate < opts.below!)
      .filter((s) => opts.above === undefined || s.solveRate > opts.above!);
    const cfgStatsCapped = opts.top ? cfgStatsFiltered.slice(0, opts.top) : cfgStatsFiltered;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, testCase: opts.testCase ?? null, byConfig: cfgStatsCapped }, null, 2));
      return;
    }

    const tcScope = opts.testCase ? `  [test case: ${opts.testCase}]` : "";
    const topNote = opts.top && opts.top < cfgStats.length ? ` (top ${opts.top} of ${cfgStats.length})` : "";
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}${tcScope}\n`);
    const cfgSortLabel = opts.sortBy === "cost" ? "most expensive first" : opts.sortBy === "runs" ? "most runs first" : "solve rate desc";
    console.log(`Per-config breakdown (${cfgStatsCapped.length} config(s)${topNote}, ${cfgSortLabel}):\n`);
    for (const cfg of cfgStatsCapped) {
      const hasTokens = cfg.avgTokensIn > 0 || cfg.avgTokensOut > 0;
      const tokLine = hasTokens ? `  avg tok: ${Math.round(cfg.avgTokensIn)}in/${Math.round(cfg.avgTokensOut)}out` : "";
      console.log(`  ${cfg.configId}`);
      console.log(`    runs: ${cfg.total}  (${cfg.passed} passed, ${cfg.failed} failed)  solve rate: ${cfg.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${cfg.avgCostUsd.toFixed(4)}/run  avg duration: ${formatDuration(cfg.avgDurationMs)}${tokLine}`);
      if (opts.showIds && cfg.lastRunId) console.log(`    last run: agr trace ${cfg.lastRunId}`);
    }
    console.log(`\nNext: agr status --config <name>  |  agr bench --suite tasks/ --configs-dir ./agents`);
    return;
  }

  if (opts.byTestCase) {
    const tcMap = new Map<string, typeof runs>();
    for (const run of runs) {
      const key = run.testCaseId;
      if (!tcMap.has(key)) tcMap.set(key, []);
      tcMap.get(key)!.push(run);
    }
    const tcStats = Array.from(tcMap.entries()).map(([testCaseId, allTcRuns]) => {
      const tcRuns = opts.rolling ? allTcRuns.slice(0, opts.rolling) : allTcRuns;
      const p = tcRuns.filter((r) => r.passed === true).length;
      const f = tcRuns.filter((r) => r.passed === false).length;
      const cost = tcRuns.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      const dur = tcRuns.reduce((s, r) => s + (r.durationMs ?? 0), 0);
      return {
        testCaseId,
        total: tcRuns.length,
        passed: p,
        failed: f,
        solveRate: tcRuns.length > 0 ? (p / tcRuns.length) * 100 : 0,
        avgCostUsd: tcRuns.length > 0 ? cost / tcRuns.length : 0,
        avgDurationMs: tcRuns.length > 0 ? dur / tcRuns.length : 0,
        lastRunId: allTcRuns[0]?.id ?? null,
      };
    }).sort((a, b) => opts.sortBy === "cost" ? b.avgCostUsd - a.avgCostUsd : opts.sortBy === "runs" ? b.total - a.total : a.solveRate - b.solveRate);
    const tcStatsFiltered = tcStats
      .filter((s) => opts.minRuns === undefined || s.total >= opts.minRuns)
      .filter((s) => opts.below === undefined || s.solveRate < opts.below!)
      .filter((s) => opts.above === undefined || s.solveRate > opts.above!);
    const tcStatsCapped = opts.top ? tcStatsFiltered.slice(0, opts.top) : tcStatsFiltered;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, config: opts.config ?? null, byTestCase: tcStatsCapped }, null, 2));
      return;
    }

    const cfgScope = opts.config ? `  [config: ${opts.config}]` : "";
    const topNote = opts.top && opts.top < tcStats.length ? ` (top ${opts.top} of ${tcStats.length})` : "";
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}${cfgScope}\n`);
    const tcSortLabel = opts.sortBy === "cost" ? "most expensive first" : opts.sortBy === "runs" ? "most runs first" : "solve rate asc";
    console.log(`Per-test-case breakdown (${tcStatsCapped.length} test case(s)${topNote}, ${tcSortLabel}):\n`);
    for (const tc of tcStatsCapped) {
      console.log(`  ${tc.testCaseId}`);
      console.log(`    runs: ${tc.total}  (${tc.passed} passed, ${tc.failed} failed)  solve rate: ${tc.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${tc.avgCostUsd.toFixed(4)}/run  avg duration: ${formatDuration(tc.avgDurationMs)}`);
      if (opts.showIds && tc.lastRunId) console.log(`    last run: agr trace ${tc.lastRunId}`);
    }
    console.log(`\nNext: agr status --test-case <name>  |  agr bench --only-failed --suite tasks/`);
    return;
  }

  if (opts.flaky) {
    const tcMap = new Map<string, typeof runs>();
    for (const run of runs) {
      if (!tcMap.has(run.testCaseId)) tcMap.set(run.testCaseId, []);
      tcMap.get(run.testCaseId)!.push(run);
    }
    const flakyStats = Array.from(tcMap.entries())
      .map(([testCaseId, tcRuns]) => {
        const p = tcRuns.filter((r) => r.passed === true).length;
        const f = tcRuns.filter((r) => r.passed === false).length;
        const cost = tcRuns.reduce((s, r) => s + (r.costUsd ?? 0), 0);
        return {
          testCaseId,
          total: tcRuns.length,
          passed: p,
          failed: f,
          solveRate: (p / tcRuns.length) * 100,
          avgCostUsd: cost / tcRuns.length,
          variance: Math.abs(0.5 - p / tcRuns.length),
        };
      })
      .filter((tc) => tc.passed > 0 && tc.failed > 0)
      .sort((a, b) => a.variance - b.variance);
    const flakyStatsCapped = opts.top ? flakyStats.slice(0, opts.top) : flakyStats;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, flaky: flakyStatsCapped }, null, 2));
      return;
    }

    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}\n`);
    if (flakyStats.length === 0) {
      console.log("No flaky test cases found (every test case has a consistent pass or fail record).");
      console.log(`\nNext: agr status --by-test-case  |  agr status --errors`);
      return;
    }
    const topNote = opts.top && opts.top < flakyStats.length ? ` (top ${opts.top} of ${flakyStats.length})` : "";
    console.log(`Flaky test cases (${flakyStatsCapped.length} case(s)${topNote}, most 50/50 first):\n`);
    for (const tc of flakyStatsCapped) {
      console.log(`  ${tc.testCaseId}`);
      console.log(`    runs: ${tc.total}  (${tc.passed} passed, ${tc.failed} failed)  solve rate: ${tc.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${tc.avgCostUsd.toFixed(4)}/run`);
    }
    console.log(`\nNext: agr status --test-case <name>  |  agr trace --last --test-case <name>`);
    return;
  }

  if (opts.errors) {
    const errorRuns = runs.filter((r) => r.error);
    if (errorRuns.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, errors: [] }, null, 2));
      } else {
        console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}\n`);
        console.log("No error messages recorded in matching runs.");
      }
      return;
    }
    const byMsg = new Map<string, { count: number; exampleRunId: string; testCaseIds: Set<string> }>();
    for (const r of errorRuns) {
      const msg = r.error!;
      const entry = byMsg.get(msg) ?? { count: 0, exampleRunId: r.id, testCaseIds: new Set() };
      entry.count++;
      entry.testCaseIds.add(r.testCaseId);
      byMsg.set(msg, entry);
    }
    const sorted = [...byMsg.entries()].sort((a, b) => b[1].count - a[1].count);
    if (opts.json) {
      const out = sorted.map(([message, e]) => ({
        message,
        count: e.count,
        exampleRunId: e.exampleRunId,
        testCaseIds: [...e.testCaseIds],
      }));
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, errors: out }, null, 2));
      return;
    }
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}\n`);
    console.log(`Error breakdown (${sorted.length} distinct error(s) across ${errorRuns.length} run(s)):\n`);
    for (const [msg, e] of sorted) {
      const tcList = [...e.testCaseIds].join(", ");
      console.log(`  [${e.count}x] ${msg}`);
      console.log(`       test cases: ${tcList}`);
      console.log(`       example:    agr trace ${e.exampleRunId}`);
    }
    console.log(`\nNext: agr trace <runId>  |  agr status --failed --by-test-case`);
    return;
  }

  if (opts.grid) {
    const testCaseIds = [...new Set(runs.map((r) => r.testCaseId))].sort();
    const configIds = [...new Set(runs.map((r) => r.agentConfigId))].sort();
    // runs are sorted newest-first; keep first occurrence per (tc, cfg) pair
    const latestResult = new Map<string, boolean | null>();
    for (const r of runs) {
      const key = `${r.testCaseId}::${r.agentConfigId}`;
      if (!latestResult.has(key)) latestResult.set(key, r.passed ?? null);
    }
    if (opts.json) {
      const cells = testCaseIds.map((tc) => ({
        testCaseId: tc,
        configs: Object.fromEntries(configIds.map((cfg) => [cfg, latestResult.get(`${tc}::${cfg}`) ?? null])),
      }));
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, testCaseIds, configIds, grid: cells }, null, 2));
      return;
    }
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}\n`);
    if (testCaseIds.length === 0) {
      console.log("No runs to display.");
      return;
    }
    const tcWidth = Math.max(...testCaseIds.map((tc) => tc.length), 12);
    const cfgWidth = Math.max(...configIds.map((c) => Math.min(c.length, 18)), 6);
    const header = "".padEnd(tcWidth + 2) + configIds.map((c) => c.slice(0, cfgWidth).padEnd(cfgWidth + 2)).join("");
    console.log(header);
    for (const tc of testCaseIds) {
      const cells = configIds.map((cfg) => {
        const r = latestResult.get(`${tc}::${cfg}`);
        const label = r === true ? "PASS" : r === false ? "FAIL" : "--  ";
        return label.padEnd(cfgWidth + 2);
      }).join("");
      console.log(`${tc.padEnd(tcWidth + 2)}${cells}`);
    }
    console.log(`\n${testCaseIds.length} test case(s) x ${configIds.length} config(s) -- latest run per pair`);
    console.log(`\nNext: agr status --by-test-case --below 100  |  agr status --by-config`);
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify({
      exists: true,
      dbPath,
      since: opts.since ?? null,
      testCase: opts.testCase ?? null,
      config: opts.config ?? null,
      model: opts.model ?? null,
      passed: opts.passed ?? null,
      totalRuns: runs.length,
      passedRuns,
      failedRuns,
      erroredRuns,
      solveRate,
      uniqueTestCases,
      uniqueConfigs,
      matrixRuns,
      totalCostUsd,
      avgCostUsd,
      avgDurationMs,
      ...(opts.percentiles ? { p50CostUsd, p95CostUsd, p50DurationMs, p95DurationMs } : {}),
      totalTokensIn,
      totalTokensOut,
      lastRunAt: lastRun?.createdAt ?? null,
      lastRunTestCaseId: lastRun?.testCaseId ?? null,
      lastRunAgentConfigId: lastRun?.agentConfigId ?? null,
    }, null, 2));
    return;
  }

  const lastRunWhen = lastRun ? formatCompactWhen(lastRun.createdAt) : "never";
  const lastRunDetail = lastRun ? `  (${lastRun.testCaseId} with ${lastRun.agentConfigId})` : "";
  const tcScope = opts.testCase ? `  [test case: ${opts.testCase}]` : "";
  const cfgScope = opts.config ? `  [config: ${opts.config}]` : "";
  const modelScope = opts.model ? `  [model: ${opts.model}]` : "";
  const passedScope = opts.passed === true ? "  [passed only]" : opts.passed === false ? "  [failed only]" : "";

  console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}${tcScope}${cfgScope}${modelScope}${passedScope}\n`);
  console.log(`  Runs:       ${runs.length} total  (${passedRuns} passed, ${failedRuns} failed${erroredRuns > 0 ? `, ${erroredRuns} errored` : ""})`);
  if (runs.length > 0 && (passedRuns > 0 || failedRuns > 0)) {
    console.log(`  Solve rate: ${solveRate.toFixed(1)}%`);
  }
  if (!opts.testCase) {
    console.log(`  Test cases: ${uniqueTestCases} unique`);
  }
  if (!opts.config) {
    console.log(`  Configs:    ${uniqueConfigs} unique`);
  }
  if (matrixRuns > 0) {
    console.log(`  Matrix:     ${matrixRuns} run(s) from matrix sweeps`);
  }
  console.log(`  Total cost: $${totalCostUsd.toFixed(4)}  avg: $${avgCostUsd.toFixed(4)}/run${opts.percentiles ? `  p50: $${p50CostUsd.toFixed(4)}  p95: $${p95CostUsd.toFixed(4)}` : ""}`);
  console.log(`  Avg duration: ${formatDuration(avgDurationMs)}${opts.percentiles ? `  p50: ${formatDuration(p50DurationMs)}  p95: ${formatDuration(p95DurationMs)}` : ""}`);
  if (totalTokensIn > 0 || totalTokensOut > 0) {
    console.log(`  Tokens:     ${totalTokensIn.toLocaleString()} in / ${totalTokensOut.toLocaleString()} out`);
  }
  console.log(`  Last run:   ${lastRunWhen}${lastRunDetail}`);
  console.log("");
  const traceHint = opts.testCase ? `agr trace --last --test-case ${opts.testCase}` : "agr trace --last";
  console.log(`Next: agr list  |  ${traceHint}  |  agr export runs --format jsonl --output runs.jsonl`);
}
