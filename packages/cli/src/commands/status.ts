import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns } from "@agentgrader/store";
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
export async function statusCommand(opts: { db?: string; json?: boolean; since?: string; testCase?: string; config?: string; passed?: boolean; byConfig?: boolean; byTestCase?: boolean; top?: number }) {
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
  const passedScope = opts.passed === true ? "  [passed only]" : opts.passed === false ? "  [failed only]" : "";

  console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}${tcScope}${cfgScope}${passedScope}\n`);
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
