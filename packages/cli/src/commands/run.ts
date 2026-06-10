import { randomUUID } from "node:crypto";
import { OpenRouterAgentAdapter } from "@crucible-agr/agent-openrouter";
import { type AgentConfig, runSingle } from "@crucible-agr/core";
import { DockerSandboxProvider } from "@crucible-agr/sandbox-docker";
import { initDb, saveTestCase } from "@crucible-agr/store";
import { loadAgentConfig } from "../lib/load-agent-config";
import { loadTestCase, testCaseToDbRow } from "../lib/load-test-case";

export async function runSingleCommand(testCasePath: string, opts: { config?: string }) {
  const testCase = loadTestCase(testCasePath);

  let agentConfig: AgentConfig = {
    id: "baseline",
    name: "Baseline Agent",
    model: "gpt-4o-mini",
    max_steps: 20,
  };

  if (opts.config) {
    agentConfig = loadAgentConfig(opts.config);
  }

  console.log(`Starting run for "${testCase.name}" using model "${agentConfig.model}"...`);

  // spin up docker + openrouter
  const sandboxProvider = new DockerSandboxProvider();
  const adapter = new OpenRouterAgentAdapter();
  const db = initDb();

  // write definitions to db before the run starts
  await saveTestCase(db, testCaseToDbRow(testCase));

  const runId = randomUUID();
  try {
    const result = await runSingle({
      testCase,
      agentConfig,
      adapter,
      sandboxProvider,
      db,
      runId,
    });

    console.log("\n================ RUN SUMMARY ================");
    console.log(`Status:    ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`Steps:     ${result.stepsCount}`);
    console.log(`Cost:      $${result.costUsd.toFixed(4)}`);
    console.log(`Duration:  ${(result.durationMs / 1000).toFixed(1)}s`);
    if (result.error) {
      console.log(`Error:     ${result.error}`);
    }
    if (result.metrics?.regression) {
      console.log(`Regression: ${result.metrics.regression.detail}`);
    }
    if (result.metrics?.diff) {
      console.log(`Diff scope: ${result.metrics.diff.detail.split("\n")[0]}`);
    }
    if (result.metrics?.localization) {
      console.log(`Localization: ${result.metrics.localization.detail.split("\n")[0]}`);
    }
    console.log("=============================================\n");
  } catch (err: any) {
    console.error(`Run failed with error: ${err.message}`);
    process.exit(1);
  }

  process.exit(0);
}
