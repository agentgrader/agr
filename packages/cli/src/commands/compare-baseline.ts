import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  diffSnapshots,
  formatBaselineDiffMarkdown,
  type BaselineSnapshot,
} from "@agentgrader/optimizer";
import { initDb, listRuns } from "@agentgrader/store";
import { buildBaselineSnapshotFromRunIds, saveBaselineSnapshot } from "../lib/baseline";

export { buildBaselineSnapshotFromRunIds, saveBaselineSnapshot };

export function loadBaselineSnapshot(path: string): BaselineSnapshot {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as BaselineSnapshot;
}

export async function compareBaselineCommand(opts: {
  snapshotA?: string;
  snapshotB?: string;
  current?: string;
  format?: "md" | "json";
  output?: string;
  db?: string;
  failOnRegression?: boolean;
  githubStepSummary?: boolean;
}) {
  const format = opts.format ?? "md";

  if (opts.current) {
    const baseline = loadBaselineSnapshot(opts.current);
    const db = initDb(opts.db ?? ".agr/db.sqlite");
    const rows = await listRuns(db);
    const runIds = rows.slice(0, baseline.runs.length).map((r) => r.id);
    const current = await buildBaselineSnapshotFromRunIds(db, runIds, {
      suite: baseline.suite,
      configs: baseline.configs,
    });
    return printDiff(baseline, current, format, opts.output, opts.failOnRegression, undefined, opts.githubStepSummary);
  }

  if (!opts.snapshotA || !opts.snapshotB) {
    throw new Error("Provide --current <baseline.json> or two snapshot paths.");
  }

  const baseline = loadBaselineSnapshot(opts.snapshotA);
  const current = loadBaselineSnapshot(opts.snapshotB);
  return printDiff(baseline, current, format, opts.output, opts.failOnRegression, {
    baseline: opts.snapshotA,
    current: opts.snapshotB,
  }, opts.githubStepSummary);
}

function printDiff(
  baseline: BaselineSnapshot,
  current: BaselineSnapshot,
  format: "md" | "json",
  output?: string,
  failOnRegression?: boolean,
  labels?: { baseline?: string; current?: string },
  githubStepSummary?: boolean,
) {
  const diff = diffSnapshots(baseline, current);
  const content =
    format === "json"
      ? JSON.stringify({ baseline, current, diff }, null, 2)
      : formatBaselineDiffMarkdown(diff, baseline, current, labels);

  if (output) {
    const path = resolve(output);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf-8");
    console.log(`Comparison written to ${path}`);
    console.log(`Next: gh pr comment --body-file ${path}  |  agr trace --last --quality`);
  } else {
    console.log(content);
  }

  if (githubStepSummary && format === "md") {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryFile) {
      console.warn("[warn] --github-step-summary: GITHUB_STEP_SUMMARY not set; skipping.");
    } else {
      const { appendFileSync } = require("node:fs");
      appendFileSync(summaryFile, `\n${content}\n`, "utf-8");
      console.log("Comparison written to $GITHUB_STEP_SUMMARY");
    }
  }

  if (failOnRegression) {
    const regressions = diff.perCaseDeltas.filter((d) => d.status === "regressed");
    if (regressions.length > 0 || diff.solveRateDelta < 0) {
      process.exit(1);
    }
  }
}
