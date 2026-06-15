import { randomUUID } from "node:crypto";
import { render } from "ink";
import React from "react";
import { type AgentConfig, type StepEvent, runSingle, computeBenchmarkSummary } from "@agentgrader/core";
import { resolveSandbox } from "../lib/resolve-sandbox";
import { initDb, saveTestCase, saveAgentConfig } from "@agentgrader/store";
import { loadAgentConfig } from "../lib/load-agent-config";
import { resolveAdapter } from "../lib/resolve-adapters";
import { loadTestCase, resolveTestCasePath, testCaseToDbRow } from "../lib/load-test-case";
import { buildExtraScorers } from "../lib/extra-scorers";
import { buildReportFromRunIds } from "../lib/report/build-report";
import { writeReport, type ReportFormat } from "../lib/report/write-report";
import { RunView, type RunSummary } from "../ui/RunView";

export async function runSingleCommand(
  testCasePath: string,
  opts: {
    config?: string;
    verbose?: boolean;
    adapter?: string;
    failOnFailure?: boolean;
    report?: ReportFormat;
    output?: string;
    reportIncludeTraces?: boolean;
    sandbox?: string;
    llmJudge?: boolean;
    llmJudgeProvider?: "anthropic" | "openai";
    llmJudgeModel?: string;
    judgeGate?: boolean;
    judgeMinScore?: number;
  },
) {
  const testCase = loadTestCase(resolveTestCasePath(testCasePath));

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

  const sandboxProvider = resolveSandbox(opts.sandbox ?? "docker");
  const adapter = resolveAdapter(opts.adapter ?? "ai-sdk");
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
  const verbose = !!opts.verbose;
  const steps: StepEvent[] = [];

  const { rerender, unmount, waitUntilExit } = render(
    <RunView testCaseName={testCase.name} model={agentConfig.model} verbose={verbose} steps={steps} />,
  );

  let exitCode = 0;
  try {
    const result = await runSingle({
      testCase,
      agentConfig,
      adapter,
      sandboxProvider,
      db,
      runId,
      extraScorers: buildExtraScorers({
        llmJudge: opts.llmJudge,
        llmJudgeProvider: opts.llmJudgeProvider,
        llmJudgeModel: opts.llmJudgeModel,
        judgeGate: opts.judgeGate,
        judgeMinScore: opts.judgeMinScore,
      }),
      onStep: (step) => {
        steps.push(step);
        rerender(
          <RunView
            testCaseName={testCase.name}
            model={agentConfig.model}
            verbose={verbose}
            steps={steps}
          />,
        );
      },
    });

    let totalCachedTokens = 0;
    let totalTokensIn = 0;
    for (const step of steps) {
      totalCachedTokens += step.cachedTokens || 0;
      totalTokensIn += step.tokensIn || 0;
    }

    const summary: RunSummary = {
      passed: result.passed,
      stepsCount: result.stepsCount,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      error: result.error,
      cachedTokens: totalCachedTokens,
      tokensIn: totalTokensIn,
      metrics: result.metrics,
      finalDiff: result.finalDiff,
    };

    rerender(
      <RunView
        testCaseName={testCase.name}
        model={agentConfig.model}
        verbose={verbose}
        steps={steps}
        summary={summary}
      />,
    );

    if (opts.failOnFailure && !result.passed) {
      exitCode = 1;
    } else {
      exitCode = 0;
    }

    if (opts.report && opts.output) {
      const summary = computeBenchmarkSummary([result], [agentConfig.id || agentConfig.name]);
      const report = await buildReportFromRunIds(
        db,
        [runId],
        summary,
        [agentConfig],
        !!opts.reportIncludeTraces,
      );
      const path = writeReport(report, opts.report, opts.output);
      console.log(`Report written to ${path}`);
    }
  } catch (err: any) {
    rerender(
      <RunView
        testCaseName={testCase.name}
        model={agentConfig.model}
        verbose={verbose}
        steps={steps}
        runError={err.message}
      />,
    );
    exitCode = 1;
  }

  unmount();
  await waitUntilExit();

  process.exit(exitCode);
}
