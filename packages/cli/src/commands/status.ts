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
export async function statusCommand(opts: { db?: string; json?: boolean; since?: string; testCase?: string; config?: string; passed?: boolean }) {
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
