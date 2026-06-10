import { resolve } from "path";
import { render } from "ink";
import React from "react";
import { initDb, saveTestCase, saveAgentConfig } from "@agentgrader/store";
import { runBenchmark, type TestCase, type AgentConfig } from "@agentgrader/core";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";
import { OpenRouterAgentAdapter } from "@agentgrader/agent-openrouter";
import { Dashboard, type RunState } from "../ui/Dashboard";
import { loadAgentConfig } from "../lib/load-agent-config";
import { loadTestCase, testCaseToDbRow, findTestCaseYamlFiles } from "../lib/load-test-case";

export async function runBenchCommand(opts: { configs: string; suite: string; concurrency?: number }) {
  const suiteDir = resolve(opts.suite);
  const configPaths = opts.configs.split(",").map((c) => resolve(c.trim()));
  const concurrency = opts.concurrency || 2;

  // 1. load agent configs
  const agentConfigs: AgentConfig[] = configPaths.map((p) => loadAgentConfig(p));

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
  const adapter = new OpenRouterAgentAdapter();

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

  // all done
  process.exit(0);
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
