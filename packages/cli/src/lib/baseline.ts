import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createBaselineSnapshot, type BaselineSnapshot } from "@agentgrader/optimizer";
import { getRun, getTraces, type AgrDb } from "@agentgrader/store";
import { countToolCalls, mergeToolCounts } from "./tool-usage";

function parseMetrics(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function buildBaselineSnapshotFromRunIds(
  db: AgrDb,
  runIds: string[],
  opts: { suite?: string; configs: string[]; gitRef?: string },
): Promise<BaselineSnapshot> {
  const runs = [];
  const toolUsage: Record<string, Record<string, number>> = {};

  for (const runId of runIds) {
    const row = await getRun(db, runId);
    if (!row) continue;
    runs.push({
      testCaseId: row.testCaseId,
      agentConfigId: row.agentConfigId,
      passed: row.passed ?? null,
      costUsd: row.costUsd ?? 0,
      durationMs: row.durationMs ?? 0,
      stepsCount: row.stepsCount ?? 0,
      tokensIn: row.tokensIn ?? 0,
      tokensOut: row.tokensOut ?? 0,
      metrics: parseMetrics(row.metrics),
    });

    const traces = await getTraces(db, runId);
    const counts = toolUsage[row.agentConfigId] ?? {};
    mergeToolCounts(counts, countToolCalls(traces));
    toolUsage[row.agentConfigId] = counts;
  }

  return createBaselineSnapshot({
    suite: opts.suite,
    configs: opts.configs,
    gitRef: opts.gitRef ?? process.env.GITHUB_REF_NAME ?? process.env.GIT_BRANCH,
    runs,
    toolUsage,
  });
}

export function saveBaselineSnapshot(snapshot: BaselineSnapshot, outputPath: string): string {
  const path = resolve(outputPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf-8");
  return path;
}
