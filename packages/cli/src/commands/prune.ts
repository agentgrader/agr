import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initDb, listRuns } from "@agentgrader/store";
import { parseSince } from "../lib/parse-since";

export async function pruneCommand(opts: { db?: string; before?: string; dryRun?: boolean; json?: boolean; yes?: boolean }) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const resolvedPath = resolve(dbPath);

  if (!existsSync(resolvedPath)) {
    console.error(`No database at ${dbPath}.`);
    process.exit(1);
  }

  if (!opts.before) {
    console.error("--before <duration|date> is required (e.g. --before 30d, --before 7d, --before 2026-01-01)");
    process.exit(1);
  }

  const db = initDb(dbPath);
  const cutoffTs = parseSince(opts.before);
  const allRuns = await listRuns(db);
  const toDelete = allRuns.filter((r) => r.createdAt < cutoffTs);

  if (toDelete.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ deleted: 0, cutoff: new Date(cutoffTs * 1000).toISOString(), dbPath }));
    } else {
      console.log(`No runs before ${new Date(cutoffTs * 1000).toISOString()} (${opts.before}). Nothing to prune.`);
    }
    return;
  }

  if (opts.json && opts.dryRun) {
    console.log(JSON.stringify({ dryRun: true, wouldDelete: toDelete.length, cutoff: new Date(cutoffTs * 1000).toISOString(), dbPath }));
    return;
  }

  if (!opts.json) {
    console.log(`Found ${toDelete.length} run(s) before ${new Date(cutoffTs * 1000).toISOString()} (${opts.before}).`);
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
  // Delete traces first (foreign key), then runs using bun:sqlite prepared statements
  const inPlaceholders = ids.map(() => "?").join(",");
  // Access the underlying bun:sqlite db through the drizzle instance
  const rawDb = (db as unknown as { _: { client: { prepare: (sql: string) => { run: (...args: string[]) => void } } } })._.client;
  rawDb.prepare(`DELETE FROM traces WHERE run_id IN (${inPlaceholders})`).run(...ids);
  rawDb.prepare(`DELETE FROM runs WHERE id IN (${inPlaceholders})`).run(...ids);;

  if (opts.json) {
    console.log(JSON.stringify({ deleted: ids.length, cutoff: new Date(cutoffTs * 1000).toISOString(), dbPath }));
  } else {
    console.log(`Deleted ${ids.length} run(s) and their traces (cutoff: ${new Date(cutoffTs * 1000).toISOString()}).`);
    console.log(`Next: agr status  |  agr count`);
  }
}
