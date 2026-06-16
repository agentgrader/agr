import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns } from "@agentgrader/store";
import { formatCompactWhen } from "../lib/format-relative-time";

/**
 * `agr status [--db <path>]`
 *
 * Prints a quick summary of the local run database without launching the
 * interactive TUI. Useful for a health-check in scripts or shell prompts
 * and as a complement to `agr list --plain` when you only need counts.
 */
export async function statusCommand(opts: { db?: string }) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const resolvedPath = resolve(dbPath);

  if (!existsSync(resolvedPath)) {
    console.log(`No database at ${dbPath}.`);
    console.log("Run `agr run` or `agr bench` first to start recording runs.");
    return;
  }

  const db = initDb(dbPath);
  const runs = await listRuns(db);

  if (runs.length === 0) {
    console.log(`Database: ${dbPath}\n`);
    console.log("No runs recorded yet. Run `agr run` or `agr bench` to get started.");
    return;
  }

  const passedRuns = runs.filter((r) => r.passed === true).length;
  const failedRuns = runs.filter((r) => r.passed === false).length;
  const erroredRuns = runs.filter((r) => r.status === "failed" && r.passed == null).length;
  const totalCost = runs.reduce((acc, r) => acc + (r.costUsd ?? 0), 0);
  const uniqueTestCases = new Set(runs.map((r) => r.testCaseId)).size;
  const uniqueConfigs = new Set(runs.map((r) => r.agentConfigId)).size;
  const lastRun = runs[0];
  const lastRunWhen = lastRun ? formatCompactWhen(lastRun.createdAt) : "never";
  const lastRunDetail = lastRun ? `  (${lastRun.testCaseId} with ${lastRun.agentConfigId})` : "";
  const matrixRuns = runs.filter((r) => r.matrixId).length;

  console.log(`Database: ${dbPath}\n`);
  console.log(`  Runs:       ${runs.length} total  (${passedRuns} passed, ${failedRuns} failed${erroredRuns > 0 ? `, ${erroredRuns} errored` : ""})`);
  console.log(`  Test cases: ${uniqueTestCases} unique`);
  console.log(`  Configs:    ${uniqueConfigs} unique`);
  if (matrixRuns > 0) {
    console.log(`  Matrix:     ${matrixRuns} run(s) from matrix sweeps`);
  }
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(`  Last run:   ${lastRunWhen}${lastRunDetail}`);
  console.log("");
  console.log(`Next: agr list  |  agr trace --last  |  agr export runs --format jsonl --output runs.jsonl`);
}
