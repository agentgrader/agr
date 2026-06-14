import { render } from "ink";
import React from "react";
import { getTraces, initDb } from "@agentgrader/store";
import { loadEnrichedRuns, formatRunStatus, shortRunId } from "../lib/load-run-list";
import { formatRunWhen } from "../lib/format-relative-time";
import { RunListApp, type TracePreviewStep } from "../ui/RunListApp";

export interface ListCommandOptions {
  db?: string;
  limit?: number;
  plain?: boolean;
}

function printPlainList(
  runs: Awaited<ReturnType<typeof loadEnrichedRuns>>,
  dbPath: string,
): void {
  if (runs.length === 0) {
    console.log(`No runs found in ${dbPath}.`);
    console.log("Run `agr run` or `agr bench` first.");
    return;
  }

  console.log(`Runs in ${dbPath} (${runs.length} shown):\n`);
  for (const run of runs) {
    const status = formatRunStatus(run);
    const when = formatRunWhen(run.createdAt);
    console.log(`${shortRunId(run.id)}  ${status.padEnd(5)}  ${run.testCaseName}`);
    console.log(`         agent: ${run.agentConfigName} (${run.agentModel})`);
    console.log(`         when:  ${when}`);
    console.log(
      `         cost: $${run.costUsd.toFixed(4)}  steps: ${run.stepsCount}  sandbox: ${run.sandboxProvider}`,
    );
    if (run.matrixId) console.log(`         matrix: ${run.matrixId}`);
    if (run.error) console.log(`         error: ${run.error}`);
    console.log(`         id: ${run.id}`);
    console.log("");
  }
  console.log("Open interactively with `agr list`, then Enter on a run to inspect.");
}

export async function listCommand(options: ListCommandOptions = {}): Promise<void> {
  const dbPath = options.db ?? ".agr/db.sqlite";
  const db = initDb(dbPath);
  const limit = options.limit ?? 100;
  const runs = await loadEnrichedRuns(db, limit);

  if (options.plain || !process.stdout.isTTY) {
    printPlainList(runs, dbPath);
    return;
  }

  const loadTraces = async (runId: string): Promise<TracePreviewStep[]> => {
    const steps = await getTraces(db, runId);
    return steps.map((step) => ({
      stepIndex: step.stepIndex,
      kind: step.kind,
      tool: step.tool,
      content: step.content,
    }));
  };

  const { waitUntilExit } = render(
    <RunListApp runs={runs} dbPath={dbPath} loadTraces={loadTraces} />,
  );

  await waitUntilExit();
}
