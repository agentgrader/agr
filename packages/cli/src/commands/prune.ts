import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns } from "@agentgrader/store";
import { parseSince } from "../lib/parse-since";

export async function pruneCommand(opts: { db?: string; before?: string; testCase?: string; config?: string; errored?: boolean; dryRun?: boolean; json?: boolean; yes?: boolean }) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const resolvedPath = resolve(dbPath);

  if (!existsSync(resolvedPath)) {
    console.error(`No database at ${dbPath}.`);
    process.exit(1);
  }

  if (!opts.before && !opts.testCase && !opts.config && !opts.errored) {
    console.error("Provide at least one of: --before <duration|date>, --test-case <name>, --config <name>, --errored");
    process.exit(1);
  }

  const db = initDb(dbPath);
  const allRuns = await listRuns(db);

  let toDelete = allRuns;

  if (opts.before) {
    const cutoffTs = parseSince(opts.before);
    toDelete = toDelete.filter((r) => r.createdAt < cutoffTs);
  }
  if (opts.testCase) {
    const tc = opts.testCase;
    toDelete = toDelete.filter((r) => r.testCaseId === tc || r.testCaseId.includes(tc));
  }
  if (opts.config) {
    const cfg = opts.config;
    toDelete = toDelete.filter((r) => r.agentConfigId === cfg || r.agentConfigId.includes(cfg));
  }
  if (opts.errored) {
    toDelete = toDelete.filter((r) => r.status === "failed" && r.passed == null);
  }

  const cutoffLabel = opts.before ? ` before ${opts.before}` : "";
  const tcLabel = opts.testCase ? ` for test case "${opts.testCase}"` : "";
  const cfgLabel = opts.config ? ` for config "${opts.config}"` : "";
  const erroredLabel = opts.errored ? " (errored)" : "";

  if (toDelete.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ deleted: 0, dbPath }));
    } else {
      console.log(`No matching runs${cutoffLabel}${tcLabel}${cfgLabel}${erroredLabel}. Nothing to prune.`);
    }
    return;
  }

  if (opts.json && opts.dryRun) {
    console.log(JSON.stringify({ dryRun: true, wouldDelete: toDelete.length, dbPath }));
    return;
  }

  if (!opts.json) {
    console.log(`Found ${toDelete.length} run(s)${cutoffLabel}${tcLabel}${cfgLabel}${erroredLabel}.`);
    if (opts.dryRun) {
      console.log("Dry run - no changes made. Remove --dry-run to delete.");
      return;
    }
    if (!opts.yes) {
      console.log(`This will permanently delete ${toDelete.length} run(s) and their traces. Use --yes to confirm or --dry-run to preview.`);
      process.exit(1);
    }
  }

  const ids = toDelete.map((r) => r.id);
  const inPlaceholders = ids.map(() => "?").join(",");
  const rawDb = (db as unknown as { _: { client: { prepare: (sql: string) => { run: (...args: string[]) => void } } } })._.client;
  rawDb.prepare(`DELETE FROM traces WHERE run_id IN (${inPlaceholders})`).run(...ids);
  rawDb.prepare(`DELETE FROM runs WHERE id IN (${inPlaceholders})`).run(...ids);

  if (opts.json) {
    console.log(JSON.stringify({ deleted: ids.length, dbPath }));
  } else {
    console.log(`Deleted ${ids.length} run(s) and their traces.`);
    console.log(`Next: agr status  |  agr count`);
  }
}
