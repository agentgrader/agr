import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns } from "@agentgrader/store";
import { formatDuration, formatCompactWhen } from "../lib/format-relative-time";

export async function watchCommand(opts: { db?: string; testCase?: string; config?: string; interval?: number; json?: boolean }) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const resolvedPath = resolve(dbPath);
  const intervalMs = (opts.interval ?? 3) * 1000;

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
    }
  };

  process.on("SIGINT", () => {
    if (!opts.json) console.log("\nStopped watching.");
    process.exit(0);
  });

  // Poll loop
  while (true) {
    await poll();
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}
