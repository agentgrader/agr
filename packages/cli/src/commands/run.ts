import { randomUUID } from "node:crypto";
import { AiSdkAgentAdapter } from "@agentgrader/agent-openrouter";
import { type AgentConfig, type StepEvent, runSingle } from "@agentgrader/core";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";
import { initDb, saveTestCase, saveAgentConfig } from "@agentgrader/store";
import { loadAgentConfig } from "../lib/load-agent-config";
import { loadTestCase, testCaseToDbRow } from "../lib/load-test-case";

const VERBOSE_CONTENT_MAX = 200;

function truncateForVerbose(value: string, max = VERBOSE_CONTENT_MAX): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function formatVerboseStep(step: StepEvent): string {
  const prefix = `[step ${step.index}] ${step.kind}`;
  if (step.kind === "tool_call" && step.tool) {
    const args = step.content ? truncateForVerbose(step.content) : "";
    return `${prefix}: ${step.tool}(${args})`;
  }
  if (step.kind === "tool_result" && step.tool) {
    const result = step.content ? truncateForVerbose(step.content) : "";
    return `${prefix}: ${step.tool} -> ${result}`;
  }
  if (step.kind === "message" && step.content) {
    return `${prefix}: ${truncateForVerbose(step.content)}`;
  }
  if (step.content) {
    return `${prefix}: ${truncateForVerbose(step.content)}`;
  }
  return prefix;
}

function formatMetricDetail(label: string, detail: string): string {
  if (/^No .+ configured; skipping/.test(detail)) {
    return `⚠️ ${label}: ${detail}`;
  }
  return `${label}: ${detail}`;
}

export async function runSingleCommand(
  testCasePath: string,
  opts: { config?: string; verbose?: boolean },
) {
  const testCase = loadTestCase(testCasePath);

  let agentConfig: AgentConfig = {
    id: "baseline",
    name: "Baseline Agent",
    model: "gpt-4o-mini",
    max_steps: 20,
  };

  if (opts.config) {
    agentConfig = loadAgentConfig(opts.config);
  } else if (testCase.agent_config) {
    agentConfig = loadAgentConfig(testCase.agent_config);
    console.log(
      `Using agent config from agr.yaml: ${testCase.agent_config} (model: ${agentConfig.model})`,
    );
  }

  console.log(`Starting run for "${testCase.name}" using model "${agentConfig.model}"...`);

  const sandboxProvider = new DockerSandboxProvider();
  const adapter = new AiSdkAgentAdapter();
  const db = initDb();

  await saveTestCase(db, testCaseToDbRow(testCase));
  await saveAgentConfig(db, {
    id: agentConfig.id || agentConfig.name,
    name: agentConfig.name,
    model: agentConfig.model,
    maxSteps: agentConfig.max_steps,
    temperature: agentConfig.temperature,
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
      onStep: opts.verbose
        ? (step) => {
            console.log(formatVerboseStep(step));
          }
        : undefined,
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
      console.log(formatMetricDetail("Regression", result.metrics.regression.detail));
    }
    if (result.metrics?.diff) {
      console.log(`Diff scope: ${result.metrics.diff.detail.split("\n")[0]}`);
    }
    if (result.metrics?.localization) {
      console.log(
        formatMetricDetail("Localization", result.metrics.localization.detail.split("\n")[0]),
      );
    }
    console.log("=============================================\n");
  } catch (err: any) {
    console.error(`Run failed with error: ${err.message}`);
    process.exit(1);
  }

  process.exit(0);
}
