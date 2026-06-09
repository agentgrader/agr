import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { parse } from "yaml";
import { initDb, saveTestCase } from "@crucible-agr/store";
import { runSingle, TestCaseSchema, type AgentConfig } from "@crucible-agr/core";
import { DockerSandboxProvider } from "@crucible-agr/sandbox-docker";
import { OpenRouterAgentAdapter } from "@crucible-agr/agent-openrouter";
import { randomUUID } from "crypto";

export async function runSingleCommand(testCasePath: string, opts: { config?: string }) {
  const path = resolve(testCasePath);
  const fileContent = readFileSync(path, "utf-8");
  const raw = parse(fileContent);

  // resolve fixture path relative to the yaml file, not cwd
  if (raw.fixture && !raw.fixture.startsWith("/") && !raw.fixture.startsWith("http")) {
    raw.fixture = resolve(dirname(path), raw.fixture);
  }

  const testCase = TestCaseSchema.parse(raw);
  testCase.id = testCase.id || testCase.name;

  let agentConfig: AgentConfig = {
    id: "baseline",
    name: "Baseline Agent",
    model: "gpt-4o-mini",
    max_steps: 20,
  };

  if (opts.config) {
    const configPath = resolve(opts.config);
    const configContent = readFileSync(configPath, "utf-8");
    const parsedConfig = parse(configContent);
    agentConfig = parsedConfig;
    agentConfig.id = agentConfig.id || agentConfig.name;
  }

  console.log(`Starting run for "${testCase.name}" using model "${agentConfig.model}"...`);

  // spin up docker + openrouter
  const sandboxProvider = new DockerSandboxProvider();
  const adapter = new OpenRouterAgentAdapter();
  const db = initDb();

  // write definitions to db before the run starts
  await saveTestCase(db, {
    id: testCase.id,
    name: testCase.name,
    description: testCase.description,
    fixture: testCase.fixture,
    prompt: testCase.prompt,
    success: JSON.stringify(testCase.success),
    timeoutSeconds: testCase.timeout_seconds,
    createdAt: Math.floor(Date.now() / 1000),
  });

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
    console.log("=============================================\n");
  } catch (err: any) {
    console.error(`Run failed with error: ${err.message}`);
    process.exit(1);
  }

  process.exit(0);
}
