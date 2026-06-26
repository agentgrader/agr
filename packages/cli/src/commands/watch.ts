import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns } from "@agentgrader/store";
import { formatDuration, formatCompactWhen } from "../lib/format-relative-time";

export async function watchCommand(opts: { db?: string; testCase?: string; config?: string; interval?: number; json?: boolean; exitOnPass?: boolean; exitOnFail?: boolean; timeout?: number; minPassRate?: number; minPassCount?: number }) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const resolvedPath = resolve(dbPath);
  const intervalMs = (opts.interval ?? 3) * 1000;
  const timeoutMs = opts.timeout !== undefined ? opts.timeout * 1000 : undefined;

  if (!existsSync(resolvedPath)) {
    console.error(`No database at ${dbPath}. Run \`agr run\` or \`agr bench\` first.`);
    process.exit(1);
  }

  const db = initDb(dbPath);
  const seenIds = new Set<string>();

  // Seed with existing run IDs so we only show NEW ones
  const existing = await listRuns(db);
  for (const r of existing) seenIds.add(r.id);

  if (!opts.json) {
    const scope: string[] = [];
    if (opts.testCase) scope.push(`test-case: ${opts.testCase}`);
    if (opts.config) scope.push(`config: ${opts.config}`);
    const scopeSuffix = scope.length ? `  [${scope.join(", ")}]` : "";
    console.log(`Watching ${dbPath} for new runs (every ${opts.interval ?? 3}s, Ctrl+C to stop)${scopeSuffix}`);
    console.log(`(${seenIds.size} existing runs skipped)\n`);
  }

  const poll = async () => {
    const runs = await listRuns(db);
    let newRuns = runs.filter((r) => !seenIds.has(r.id));
    if (opts.testCase) newRuns = newRuns.filter((r) => r.testCaseId === opts.testCase || r.testCaseId.includes(opts.testCase!));
    if (opts.config) newRuns = newRuns.filter((r) => r.agentConfigId === opts.config || r.agentConfigId.includes(opts.config!));

    for (const r of newRuns) {
      seenIds.add(r.id);
      if (opts.json) {
        console.log(JSON.stringify({
          id: r.id,
          testCaseId: r.testCaseId,
          agentConfigId: r.agentConfigId,
          passed: r.passed,
          costUsd: r.costUsd,
          durationMs: r.durationMs,
          stepsCount: r.stepsCount,
          createdAt: r.createdAt,
        }));
      } else {
        const status = r.passed === true ? "PASS" : r.passed === false ? "FAIL" : "ERR ";
        const when = formatCompactWhen(r.createdAt);
        const cost = `$${r.costUsd.toFixed(4)}`;
        const dur = formatDuration(r.durationMs);
        const id = r.id.slice(0, 8);
        console.log(`  ${status}  ${r.testCaseId.padEnd(32)} ${r.agentConfigId.padEnd(20)} ${cost}  ${dur}  ${id}  (${when})`);
      }
      if (opts.exitOnPass && r.passed === true) {
        if (!opts.json) console.log(`\n[exit-on-pass] Passing run detected (${r.id.slice(0, 8)}). Exiting.`);
        process.exit(0);
      }
      if (opts.exitOnFail && r.passed === false) {
        if (!opts.json) console.log(`\n[exit-on-fail] Failing run detected (${r.id.slice(0, 8)}). Exiting with code 1.`);
        process.exit(1);
      }
    }
    // Check pass rate gates across all seen runs
    if ((opts.minPassRate !== undefined || opts.minPassCount !== undefined) && newRuns.length > 0) {
      const allSeen = [...seenIds];
      const allRuns2 = await listRuns(db);
      const seenRuns = allRuns2.filter((r) => allSeen.includes(r.id));
      const seenPassed = seenRuns.filter((r) => r.passed === true).length;
      const seenTotal = seenRuns.length;
      if (opts.minPassRate !== undefined && seenTotal > 0) {
        const rate = seenPassed / seenTotal;
        if (rate >= opts.minPassRate) {
          if (!opts.json) console.log(`\n[min-pass-rate] ${(rate * 100).toFixed(1)}% >= ${(opts.minPassRate * 100).toFixed(1)}% target (${seenPassed}/${seenTotal}). Exiting.`);
          process.exit(0);
        }
      }
      if (opts.minPassCount !== undefined && seenPassed >= opts.minPassCount) {
        if (!opts.json) console.log(`\n[min-pass-count] ${seenPassed} passes reached target of ${opts.minPassCount}. Exiting.`);
        process.exit(0);
      }
    }
  };

  process.on("SIGINT", () => {
    if (!opts.json) console.log("\nStopped watching.");
    process.exit(0);
  });

  const startMs = Date.now();
  let lastNewRunMs = Date.now();

  const origPoll = poll;
  const pollWithTracking = async () => {
    const sizeBefore = seenIds.size;
    await origPoll();
    if (seenIds.size > sizeBefore) lastNewRunMs = Date.now();
  };

  // Poll loop
  while (true) {
    await pollWithTracking();
    if (timeoutMs !== undefined && Date.now() - lastNewRunMs > timeoutMs) {
      if (!opts.json) console.log(`\n[timeout] No new runs in ${opts.timeout}s. Exiting with code 2.`);
      process.exit(2);
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}
