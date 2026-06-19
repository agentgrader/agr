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
export async function statusCommand(opts: { db?: string; json?: boolean; since?: string; testCase?: string; config?: string; model?: string; sandbox?: string; passed?: boolean; byConfig?: boolean; byTestCase?: boolean; byModel?: boolean; bySandbox?: boolean; top?: number; matrixId?: string; lastMatrix?: boolean }) {
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

  if (opts.byModel) {
    const cfgRows = await db.select().from(agentConfigs);
    const modelByConfigId = new Map(cfgRows.map((r) => [r.id, r.model ?? "unknown"]));
    const modelMap = new Map<string, typeof runs>();
    for (const run of runs) {
      const key = modelByConfigId.get(run.agentConfigId) ?? "unknown";
      if (!modelMap.has(key)) modelMap.set(key, []);
      modelMap.get(key)!.push(run);
    }
    const modelStats = Array.from(modelMap.entries()).map(([model, mRuns]) => {
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
      };
    }).sort((a, b) => b.solveRate - a.solveRate);
    const modelStatsCapped = opts.top ? modelStats.slice(0, opts.top) : modelStats;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, testCase: opts.testCase ?? null, config: opts.config ?? null, byModel: modelStatsCapped }, null, 2));
      return;
    }

    const topNote = opts.top && opts.top < modelStats.length ? ` (top ${opts.top} of ${modelStats.length})` : "";
    const tcScope = opts.testCase ? `  [test case: ${opts.testCase}]` : "";
    const cfgScope = opts.config ? `  [config: ${opts.config}]` : "";
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}${tcScope}${cfgScope}\n`);
    console.log(`Per-model breakdown (${modelStatsCapped.length} model(s)${topNote}, sorted by solve rate):\n`);
    for (const ms of modelStatsCapped) {
      const hasTokens = ms.avgTokensIn > 0 || ms.avgTokensOut > 0;
      const tokLine = hasTokens ? `  avg tok: ${Math.round(ms.avgTokensIn)}in/${Math.round(ms.avgTokensOut)}out` : "";
      console.log(`  ${ms.model}`);
      console.log(`    runs: ${ms.total}  (${ms.passed} passed, ${ms.failed} failed)  solve rate: ${ms.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${ms.avgCostUsd.toFixed(4)}/run  avg duration: ${formatDuration(ms.avgDurationMs)}${tokLine}`);
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
    const cfgStats = Array.from(cfgMap.entries()).map(([configId, cfgRuns]) => {
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
      };
    }).sort((a, b) => b.solveRate - a.solveRate);
    const cfgStatsCapped = opts.top ? cfgStats.slice(0, opts.top) : cfgStats;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, testCase: opts.testCase ?? null, byConfig: cfgStatsCapped }, null, 2));
      return;
    }

    const tcScope = opts.testCase ? `  [test case: ${opts.testCase}]` : "";
    const topNote = opts.top && opts.top < cfgStats.length ? ` (top ${opts.top} of ${cfgStats.length})` : "";
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}${tcScope}\n`);
    console.log(`Per-config breakdown (${cfgStatsCapped.length} config(s)${topNote}, sorted by solve rate):\n`);
    for (const cfg of cfgStatsCapped) {
      const hasTokens = cfg.avgTokensIn > 0 || cfg.avgTokensOut > 0;
      const tokLine = hasTokens ? `  avg tok: ${Math.round(cfg.avgTokensIn)}in/${Math.round(cfg.avgTokensOut)}out` : "";
      console.log(`  ${cfg.configId}`);
      console.log(`    runs: ${cfg.total}  (${cfg.passed} passed, ${cfg.failed} failed)  solve rate: ${cfg.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${cfg.avgCostUsd.toFixed(4)}/run  avg duration: ${formatDuration(cfg.avgDurationMs)}${tokLine}`);
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
    const tcStats = Array.from(tcMap.entries()).map(([testCaseId, tcRuns]) => {
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
      };
    }).sort((a, b) => a.solveRate - b.solveRate);
    const tcStatsCapped = opts.top ? tcStats.slice(0, opts.top) : tcStats;

    if (opts.json) {
      console.log(JSON.stringify({ exists: true, dbPath, since: opts.since ?? null, config: opts.config ?? null, byTestCase: tcStatsCapped }, null, 2));
      return;
    }

    const cfgScope = opts.config ? `  [config: ${opts.config}]` : "";
    const topNote = opts.top && opts.top < tcStats.length ? ` (top ${opts.top} of ${tcStats.length})` : "";
    console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}${cfgScope}\n`);
    console.log(`Per-test-case breakdown (${tcStatsCapped.length} test case(s)${topNote}, sorted by solve rate asc):\n`);
    for (const tc of tcStatsCapped) {
      console.log(`  ${tc.testCaseId}`);
      console.log(`    runs: ${tc.total}  (${tc.passed} passed, ${tc.failed} failed)  solve rate: ${tc.solveRate.toFixed(1)}%`);
      console.log(`    avg cost: $${tc.avgCostUsd.toFixed(4)}/run  avg duration: ${formatDuration(tc.avgDurationMs)}`);
    }
    console.log(`\nNext: agr status --test-case <name>  |  agr bench --only-failed --suite tasks/`);
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
  console.log(`  Total cost: $${totalCostUsd.toFixed(4)}  avg: $${avgCostUsd.toFixed(4)}/run`);
  console.log(`  Avg duration: ${formatDuration(avgDurationMs)}`);
  if (totalTokensIn > 0 || totalTokensOut > 0) {
    console.log(`  Tokens:     ${totalTokensIn.toLocaleString()} in / ${totalTokensOut.toLocaleString()} out`);
  }
  console.log(`  Last run:   ${lastRunWhen}${lastRunDetail}`);
  console.log("");
  const traceHint = opts.testCase ? `agr trace --last --test-case ${opts.testCase}` : "agr trace --last";
  console.log(`Next: agr list  |  ${traceHint}  |  agr export runs --format jsonl --output runs.jsonl`);
}
