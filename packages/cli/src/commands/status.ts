import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns } from "@agentgrader/store";
import { formatCompactWhen } from "../lib/format-relative-time";
import { parseSince } from "../lib/parse-since";

/**
 * `agr status [--db <path>] [--json]`
 *
 * Prints a quick summary of the local run database without launching the
 * interactive TUI. Useful for a health-check in scripts or shell prompts
 * and as a complement to `agr list --plain` when you only need counts.
 * Pass `--json` for machine-readable output.
 */
export async function statusCommand(opts: { db?: string; json?: boolean; since?: string }) {
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

  if (opts.json) {
    console.log(JSON.stringify({
      exists: true,
      dbPath,
      since: opts.since ?? null,
      totalRuns: runs.length,
      passedRuns,
      failedRuns,
      erroredRuns,
      uniqueTestCases,
      uniqueConfigs,
      matrixRuns,
      totalCostUsd,
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

  console.log(`Database: ${dbPath}${sinceLabel ? `  [since ${sinceLabel}]` : ""}\n`);
  console.log(`  Runs:       ${runs.length} total  (${passedRuns} passed, ${failedRuns} failed${erroredRuns > 0 ? `, ${erroredRuns} errored` : ""})`);
  console.log(`  Test cases: ${uniqueTestCases} unique`);
  console.log(`  Configs:    ${uniqueConfigs} unique`);
  if (matrixRuns > 0) {
    console.log(`  Matrix:     ${matrixRuns} run(s) from matrix sweeps`);
  }
  console.log(`  Total cost: $${totalCostUsd.toFixed(4)}`);
  if (totalTokensIn > 0 || totalTokensOut > 0) {
    console.log(`  Tokens:     ${totalTokensIn.toLocaleString()} in / ${totalTokensOut.toLocaleString()} out`);
  }
  console.log(`  Last run:   ${lastRunWhen}${lastRunDetail}`);
  console.log("");
  console.log(`Next: agr list  |  agr trace --last  |  agr export runs --format jsonl --output runs.jsonl`);
}
