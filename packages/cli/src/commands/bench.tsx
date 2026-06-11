import { randomUUID } from "node:crypto";
import { resolve } from "path";
import { render } from "ink";
import React from "react";
import { initDb, saveTestCase, saveAgentConfig, getRunsByMatrixId, type AgrDb } from "@agentgrader/store";
import { runBenchmark, type TestCase, type AgentConfig } from "@agentgrader/core";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";
import { AiSdkAgentAdapter } from "@agentgrader/agent-openrouter";
import { StaticQualityScorer } from "@agentgrader/scorer-static";
import { expandMatrix, aggregateResults, paretoFront } from "@agentgrader/optimizer";
import { Dashboard, type RunState } from "../ui/Dashboard";
import { loadAgentConfig } from "../lib/load-agent-config";
import { loadMatrix } from "../lib/load-matrix";
import { loadTestCase, testCaseToDbRow, findTestCaseYamlFiles } from "../lib/load-test-case";

export async function runBenchCommand(opts: {
  configs?: string;
  suite: string;
  concurrency?: number;
  matrix?: string;
}) {
  const suiteDir = resolve(opts.suite);
  const concurrency = opts.concurrency || 2;

  // 1. load agent configs. either expanded from a matrix (cartesian product
  // of dimensions, for an optimizer sweep) or from explicit --configs paths
  let agentConfigs: AgentConfig[];
  let matrixId: string | undefined;
  if (opts.matrix) {
    const matrix = loadMatrix(opts.matrix);
    agentConfigs = expandMatrix(matrix);
    matrixId = randomUUID();
    console.log(
      `Matrix "${matrix.name}" expanded to ${agentConfigs.length} agent config(s) (matrixId: ${matrixId})`,
    );
  } else if (opts.configs) {
    const configPaths = opts.configs.split(",").map((c) => resolve(c.trim()));
    agentConfigs = configPaths.map((p) => loadAgentConfig(p));
  } else {
    throw new Error("Either --configs or --matrix must be provided.");
  }

  // 2. find and parse test case yamls
  const yamlFiles = findTestCaseYamlFiles(suiteDir);
  if (yamlFiles.length === 0) {
    console.error(`No test cases found in suite directory: ${opts.suite}`);
    process.exit(1);
  }

  const testCases: TestCase[] = [];
  for (const f of yamlFiles) {
    testCases.push(loadTestCase(f));
  }

  // 3. open the sqlite db
  const db = initDb();

  // persist test case + config definitions so the db has context for each run
  for (const tc of testCases) {
    await saveTestCase(db, testCaseToDbRow(tc));
  }

  for (const ac of agentConfigs) {
    await saveAgentConfig(db, {
      id: ac.id || ac.name,
      name: ac.name,
      model: ac.model,
      maxSteps: ac.max_steps,
      temperature: ac.temperature,
      systemPrompt: ac.system_prompt,
      tools: JSON.stringify(ac.tools),
      createdAt: Math.floor(Date.now() / 1000),
    });
  }

  // 4. wire up providers
  const sandboxProvider = new DockerSandboxProvider();
  const adapter = new AiSdkAgentAdapter();

  // 5. render the live dashboard
  const runStates: Record<string, RunState> = {};
  const testCaseIds = testCases.map((tc) => tc.id || tc.name);
  const configIds = agentConfigs.map((ac) => ac.id || ac.name);

  const { rerender, waitUntilExit } = render(
    <Dashboard
      runs={runStates}
      testCases={testCaseIds}
      configs={configIds}
      isFinished={false}
    />
  );

  const onRunUpdate = (run: any) => {
    const key = `${run.testCaseId}_${run.agentConfigId}`;
    runStates[key] = run;
    rerender(
      <Dashboard
        runs={runStates}
        testCases={testCaseIds}
        configs={configIds}
        isFinished={false}
      />
    );
  };

  // 6. kick off the benchmark
  try {
    await runBenchmark({
      testCases,
      agentConfigs,
      adapter,
      sandboxProvider,
      db,
      concurrency,
      onRunUpdate,
      extraScorers: [new StaticQualityScorer()],
      matrixId,
    });
  } catch (err) {
    console.error("Benchmark runner encountered an error:", err);
  }

  // re-render one last time with isFinished so the dashboard shows the final state
  rerender(
    <Dashboard
      runs={runStates}
      testCases={testCaseIds}
      configs={configIds}
      isFinished={true}
    />
  );

  printTagBreakdown(testCases, agentConfigs, runStates);

  if (matrixId) {
    await printMatrixSummary(db, matrixId, agentConfigs);
  }

  // all done
  process.exit(0);
}

/**
 * Aggregates all runs from this matrix sweep by agent config and prints a
 * solve-rate / cost / quality breakdown, marking the Pareto-optimal configs.
 */
async function printMatrixSummary(db: AgrDb, matrixId: string, agentConfigs: AgentConfig[]) {
  const runs = await getRunsByMatrixId(db, matrixId);
  const aggregates = aggregateResults(runs, agentConfigs);
  if (aggregates.length === 0) return;

  const front = paretoFront(aggregates);
  const frontIds = new Set(front.map((a) => a.agentConfigId));
  const includesQuality = front.some((a) => a.avgQuality?.linterViolations !== undefined);

  console.log("\n================ MATRIX SUMMARY ================");
  for (const agg of aggregates) {
    const marker = frontIds.has(agg.agentConfigId) ? "*" : " ";
    const solveRatePct = (agg.solveRate * 100).toFixed(0);
    const lint =
      agg.avgQuality?.linterViolations !== undefined
        ? ` lint:${agg.avgQuality.linterViolations.toFixed(1)}`
        : "";
    console.log(
      `${marker} ${agg.agentConfigName.padEnd(36)} solve:${solveRatePct.padStart(3)}% (${agg.passedRuns}/${agg.totalRuns}) cost:$${agg.avgCostUsd.toFixed(4)}${lint}`,
    );
  }
  console.log(
    `\n* = Pareto-optimal (solve rate, cost${includesQuality ? ", lint violations" : ""})`,
  );
  console.log("=================================================\n");
}

/**
 * Prints a per-tag pass-rate breakdown across all runs, e.g. "regression: 4/6 (67%)".
 * Useful for spotting whether a model is systematically weak on a category
 * of tasks (off-by-one, async, etc.) - an idea borrowed from SWE-bench's
 * per-repo / per-difficulty breakdowns.
 */
function printTagBreakdown(
  testCases: TestCase[],
  agentConfigs: AgentConfig[],
  runStates: Record<string, RunState>
) {
  const tagStats: Record<string, { passed: number; total: number }> = {};

  for (const tc of testCases) {
    const tags = tc.tags ?? [];
    if (tags.length === 0) continue;

    for (const ac of agentConfigs) {
      const key = `${tc.id || tc.name}_${ac.id || ac.name}`;
      const run = runStates[key];
      if (!run || run.status === "running") continue;

      for (const tag of tags) {
        const stats = (tagStats[tag] ??= { passed: 0, total: 0 });
        stats.total++;
        if (run.passed) stats.passed++;
      }
    }
  }

  const tags = Object.keys(tagStats).sort();
  if (tags.length === 0) return;

  console.log("\n================ TAG BREAKDOWN ================");
  for (const tag of tags) {
    const { passed, total } = tagStats[tag];
    const pct = total > 0 ? ((passed / total) * 100).toFixed(0) : "0";
    console.log(`${tag.padEnd(24)} ${passed}/${total} (${pct}%)`);
  }
  console.log("=================================================\n");
}
