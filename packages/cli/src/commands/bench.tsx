import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { parse } from "yaml";
import { render } from "ink";
import React from "react";
import { initDb, saveTestCase, saveAgentConfig } from "@crucible-agr/store";
import { runBenchmark, TestCaseSchema, AgentConfigSchema, type TestCase, type AgentConfig } from "@crucible-agr/core";
import { DockerSandboxProvider } from "@crucible-agr/sandbox-docker";
import { OpenRouterAgentAdapter } from "@crucible-agr/agent-openrouter";
import { Dashboard, type RunState } from "../ui/Dashboard";

function findTestCaseYamlFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry !== "fixture" && entry !== "node_modules" && !entry.startsWith(".")) {
          files.push(...findTestCaseYamlFiles(fullPath));
        }
      } else if (entry === "crucible.yaml" || (entry.endsWith(".yaml") && !entry.includes("config"))) {
        files.push(fullPath);
      }
    }
  } catch (e) { }
  return files;
}

export async function runBenchCommand(opts: { configs: string; suite: string; concurrency?: number }) {
  const suiteDir = resolve(opts.suite);
  const configPaths = opts.configs.split(",").map((c) => resolve(c.trim()));
  const concurrency = opts.concurrency || 2;

  // 1. load agent configs
  const agentConfigs: AgentConfig[] = [];
  for (const p of configPaths) {
    const fileContent = readFileSync(p, "utf-8");
    const raw = parse(fileContent);
    const parsed = AgentConfigSchema.parse(raw);
    const configId = parsed.id || parsed.name;
    agentConfigs.push({ ...parsed, id: configId });
  }

  // 2. find and parse test case yamls
  const yamlFiles = findTestCaseYamlFiles(suiteDir);
  if (yamlFiles.length === 0) {
    console.error(`No test cases found in suite directory: ${opts.suite}`);
    process.exit(1);
  }

  const testCases: TestCase[] = [];
  for (const f of yamlFiles) {
    const fileContent = readFileSync(f, "utf-8");
    const raw = parse(fileContent);

    // make fixture paths absolute relative to the yaml file
    if (raw.fixture && !raw.fixture.startsWith("/") && !raw.fixture.startsWith("http")) {
      raw.fixture = resolve(dirname(f), raw.fixture);
    }

    const parsed = TestCaseSchema.parse(raw);
    const caseId = parsed.id || parsed.name;
    testCases.push({ ...parsed, id: caseId });
  }

  // 3. open the sqlite db
  const db = initDb();

  // persist test case + config definitions so the db has context for each run
  for (const tc of testCases) {
    await saveTestCase(db, {
      id: tc.id || tc.name,
      name: tc.name,
      description: tc.description,
      fixture: tc.fixture,
      prompt: tc.prompt,
      success: JSON.stringify(tc.success),
      timeoutSeconds: tc.timeout_seconds,
      createdAt: Math.floor(Date.now() / 1000),
    });
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

  // all done
  process.exit(0);
}
