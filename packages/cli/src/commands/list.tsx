import { render } from "ink";
import React from "react";
import { getTraces, initDb } from "@agentgrader/store";
import { loadEnrichedRuns, formatRunStatus, shortRunId, type RunSortField } from "../lib/load-run-list";
import { formatRunWhen, formatDuration } from "../lib/format-relative-time";
import { clearTerminalScreen, enterAlternateScreen, leaveAlternateScreen } from "../lib/list-table-layout";
import { RunListApp, type TracePreviewStep } from "../ui/RunListApp";
import { parseSince } from "../lib/parse-since";

export interface ListCommandOptions {
  db?: string;
  limit?: number;
  plain?: boolean;
  json?: boolean;
  since?: string;
  testCase?: string;
  config?: string;
  passed?: boolean;
  model?: string;
  sort?: RunSortField;
  matrixId?: string;
  lastMatrix?: boolean;
  sandbox?: string;
}

function printPlainList(
  runs: Awaited<ReturnType<typeof loadEnrichedRuns>>,
  dbPath: string,
  sinceLabel?: string,
  tcLabel?: string,
  cfgLabel?: string,
  passedLabel?: string,
): void {
  if (runs.length === 0) {
    const scope = [
      sinceLabel ? `since ${sinceLabel}` : "",
      tcLabel ? `for test case "${tcLabel}"` : "",
      cfgLabel ? `for config "${cfgLabel}"` : "",
      passedLabel ? passedLabel : "",
    ].filter(Boolean).join(", ");
    console.log(`No runs found in ${dbPath}${scope ? ` (${scope})` : ""}.`);
    console.log("Run `agr run` or `agr bench` first.");
    return;
  }

  const sinceNote = sinceLabel ? `  [since ${sinceLabel}]` : "";
  const tcNote = tcLabel ? `  [test case: ${tcLabel}]` : "";
  const cfgNote = cfgLabel ? `  [config: ${cfgLabel}]` : "";
  const passedNote = passedLabel ? `  [${passedLabel}]` : "";
  console.log(`Runs in ${dbPath} (${runs.length} shown)${sinceNote}${tcNote}${cfgNote}${passedNote}:\n`);
  for (const run of runs) {
    const status = formatRunStatus(run);
    const when = formatRunWhen(run.createdAt);
    console.log(`${shortRunId(run.id)}  ${status.padEnd(5)}  ${run.testCaseName}`);
    console.log(`         agent: ${run.agentConfigName} (${run.agentModel})`);
    console.log(`         when:  ${when}`);
    const tokNote = run.tokensIn > 0 || run.tokensOut > 0 ? `  tokens: ${run.tokensIn}in/${run.tokensOut}out` : "";
    console.log(
      `         cost: $${run.costUsd.toFixed(4)}  steps: ${run.stepsCount}  duration: ${formatDuration(run.durationMs)}  sandbox: ${run.sandboxProvider}${tokNote}`,
    );
    if (run.matrixId) console.log(`         matrix: ${run.matrixId}`);
    if (run.error) console.log(`         error: ${run.error}`);
    console.log(`         id: ${run.id}`);
    console.log("");
  }
  console.log("Trace most recent:  agr trace --last  |  agr trace --last --quality");
  console.log("Compare two runs:   agr compare --last-two");
  console.log("Browse runs (TUI):  agr list");
}

export async function listCommand(options: ListCommandOptions = {}): Promise<void> {
  const dbPath = options.db ?? ".agr/db.sqlite";
  const db = initDb(dbPath);
  const limit = options.limit ?? 100;
  const sinceTs = options.since ? parseSince(options.since) : undefined;
  const runs = await loadEnrichedRuns(db, limit, sinceTs, options.testCase, options.config, options.passed, options.model, options.sort, options.matrixId, options.lastMatrix, options.sandbox);

  const sinceLabel = options.since ? `${options.since} (${new Date((sinceTs ?? 0) * 1000).toISOString()})` : undefined;
  const tcLabel = options.testCase ? options.testCase : undefined;
  const cfgLabel = options.config ? options.config : undefined;
  const passedLabel = options.passed === true ? "passed only" : options.passed === false ? "failed only" : undefined;

  if (options.json) {
    const output = runs.map(({ finalDiff: _fd, ...run }) => run);
    console.log(JSON.stringify(output));
    return;
  }

  if (options.plain || !process.stdout.isTTY) {
    printPlainList(runs, dbPath, sinceLabel, tcLabel, cfgLabel, passedLabel);
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

  enterAlternateScreen(process.stdout);
  clearTerminalScreen(process.stdout);

  const { waitUntilExit } = render(
    <RunListApp runs={runs} dbPath={dbPath} loadTraces={loadTraces} />,
  );

  try {
    await waitUntilExit();
  } finally {
    leaveAlternateScreen(process.stdout);
  }
}
