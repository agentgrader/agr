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
import { formatDuration } from "../lib/format-relative-time";

export async function runSingleCommand(
  testCasePath: string,
  opts: {
    config?: string;
    model?: string;
    maxSteps?: number;
    json?: boolean;
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
    repeat?: number;
  },
) {
  const resolvedPath = resolveTestCasePath(testCasePath);
  const testCase = loadTestCase(resolvedPath);

  let agentConfig: AgentConfig;

  if (opts.config) {
    agentConfig = loadAgentConfig(opts.config);
  } else if (testCase.agent_config) {
    agentConfig = loadAgentConfig(testCase.agent_config);
    console.log(
      `Using agent config from agr.yaml: ${testCase.agent_config} (model: ${agentConfig.model})`,
    );
  } else {
    console.error(
      `No agent config specified. Either:\n  - Pass --config <path> to the CLI\n  - Add agent_config: <path> to your agr.yaml`,
    );
    process.exit(1);
  }

  if (opts.model) {
    if (!opts.json) console.log(`Overriding model: ${agentConfig.model} -> ${opts.model}`);
    agentConfig = { ...agentConfig, model: opts.model };
  }

  if (opts.maxSteps !== undefined) {
    if (!opts.json) console.log(`Overriding max_steps: ${agentConfig.maxSteps ?? agentConfig.max_steps ?? "default"} -> ${opts.maxSteps}`);
    agentConfig = { ...agentConfig, max_steps: opts.maxSteps, maxSteps: opts.maxSteps };
  }

  const sandboxProvider = resolveSandbox(opts.sandbox ?? "docker");
  const adapter = resolveAdapter(opts.adapter ?? "ai-sdk");
  const db = initDb();

  const repeat = opts.repeat && opts.repeat > 1 ? opts.repeat : 1;

  if (repeat > 1) {
    await saveTestCase(db, testCaseToDbRow(testCase));
    await saveAgentConfig(db, {
      id: agentConfig.id || agentConfig.name,
      name: agentConfig.name,
      model: agentConfig.model,
      maxSteps: agentConfig.max_steps,
      temperature: agentConfig.temperature,
      createdAt: Math.floor(Date.now() / 1000),
    });

    if (!opts.json) console.log(`Repeating "${testCase.name}" x${repeat} using model "${agentConfig.model}"...\n`);
    const results: Array<{ passed: boolean | null; costUsd: number; durationMs: number; runId: string; error?: string }> = [];

    for (let i = 0; i < repeat; i++) {
      const runId = randomUUID();
      if (!opts.json) process.stdout.write(`  [${i + 1}/${repeat}] running...`);
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
        });
        if (!opts.json) {
          const status = result.passed === true ? "PASS" : result.passed === false ? "FAIL" : "ERROR";
          process.stdout.write(`\r  [${i + 1}/${repeat}] ${status.padEnd(5)} $${result.costUsd.toFixed(4)}  ${formatDuration(result.durationMs)}  ${runId.slice(0, 8)}\n`);
        }
        results.push({ passed: result.passed, costUsd: result.costUsd, durationMs: result.durationMs, runId });
      } catch (err: any) {
        if (!opts.json) process.stdout.write(`\r  [${i + 1}/${repeat}] ERROR ${err.message}\n`);
        results.push({ passed: null, costUsd: 0, durationMs: 0, runId, error: err.message });
      }
    }

    const passed = results.filter((r) => r.passed === true).length;
    const totalCost = results.reduce((s, r) => s + r.costUsd, 0);
    const avgCost = totalCost / results.length;
    const avgDuration = results.reduce((s, r) => s + r.durationMs, 0) / results.length;
    const solveRate = passed / results.length;

    if (opts.json) {
      console.log(JSON.stringify({
        testCaseId: testCase.name,
        agentConfigId: agentConfig.id || agentConfig.name,
        model: agentConfig.model,
        repeat,
        passedRuns: passed,
        totalRuns: results.length,
        solveRate,
        totalCostUsd: totalCost,
        avgCostUsd: avgCost,
        avgDurationMs: avgDuration,
        runs: results,
      }));
      if (opts.failOnFailure && passed < results.length) process.exit(1);
      process.exit(0);
    }

    console.log(`\nRepeat summary (${repeat} runs):`);
    console.log(`  Result: ${passed}/${repeat} PASS (${(solveRate * 100).toFixed(1)}%)`);
    console.log(`  Cost:   $${totalCost.toFixed(4)} total  avg: $${avgCost.toFixed(4)}/run`);
    console.log(`  Duration: avg ${formatDuration(avgDuration)}`);

    if (opts.failOnFailure && passed < results.length) {
      console.log(`\nInspect: agr trace --last --test-case ${testCase.name}  |  agr list --plain --failed`);
      process.exit(1);
    }
    console.log(`\nNext: agr trace --last --test-case ${testCase.name}  |  agr bench ${testCase.name}`);
    process.exit(0);
  }

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

  // JSON output mode: skip Ink UI and write result as JSON
  if (opts.json) {
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
      });
      console.log(
        JSON.stringify({
          passed: result.passed,
          runId,
          testCaseId: testCase.name,
          agentConfigId: agentConfig.id || agentConfig.name,
          model: agentConfig.model,
          costUsd: result.costUsd,
          durationMs: result.durationMs,
          stepsCount: result.stepsCount,
          metrics: result.metrics ?? null,
          error: result.error ?? null,
        }),
      );
      if (opts.failOnFailure && !result.passed) process.exit(1);
    } catch (err: any) {
      console.log(JSON.stringify({ passed: null, runId, error: err.message }));
      process.exit(1);
    }
    return;
  }

  console.log(`Starting run for "${testCase.name}" (${resolvedPath}) using model "${agentConfig.model}"...`);

  const verbose = !!opts.verbose;
  const steps: StepEvent[] = [];

  const { rerender, unmount, waitUntilExit } = render(
    <RunView testCaseName={testCase.name} model={agentConfig.model} verbose={verbose} steps={steps} />,
  );

  let exitCode = 0;
  let summary: RunSummary | undefined;
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

    summary = {
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

    if (opts.report && !opts.output) {
      console.warn(`Warning: --report ${opts.report} has no effect without --output <path>.`);
    }

    if (opts.report && opts.output) {
      const benchSummary = computeBenchmarkSummary([result], [agentConfig.id || agentConfig.name]);
      const report = await buildReportFromRunIds(
        db,
        [runId],
        benchSummary,
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

  const passed = summary?.passed;
  if (passed === true) {
    console.log(`\nNext: agr bench ${testCase.name}  |  agr trace ${runId}  |  agr trace --last --quality`);
  } else {
    console.log(`\nInspect: agr trace ${runId}  |  agr trace --last --quality  |  agr trace --last --tools`);
  }

  process.exit(exitCode);
}
