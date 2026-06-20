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
import { buildTimestampedReportPath, writeReport, type ReportFormat } from "../lib/report/write-report";
import { buildBaselineSnapshotFromRunIds, saveBaselineSnapshot } from "../lib/baseline";
import { RunView, type RunSummary } from "../ui/RunView";
import { formatDuration } from "../lib/format-relative-time";
import { findEnvFile } from "../lib/load-env";
import { missingApiKeyForAgentConfig } from "../lib/preflight-api-key";
import {
  formatNextSteps,
  formatOverrideLine,
  formatSuccess,
  formatWarning,
  printMissingApiKeyError,
  printNoAgentConfigError,
  printRunContext,
  printRunStartLine,
} from "../lib/cli-output";
import { stdoutSupportsColor } from "../lib/terminal";

export async function runSingleCommand(
  testCasePath: string,
  opts: {
    config?: string;
    model?: string;
    provider?: string;
    temperature?: number;
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
    untilPass?: boolean;
    maxAttempts?: number;
    stepTimeout?: number;
    saveBaseline?: string;
    reportDir?: string;
    dryRun?: boolean;
  },
) {
  const resolvedPath = resolveTestCasePath(testCasePath);
  const testCase = loadTestCase(resolvedPath);

  let agentConfig: AgentConfig;
  let configPath: string | undefined;

  if (opts.config) {
    configPath = opts.config;
    agentConfig = loadAgentConfig(opts.config);
  } else if (testCase.agent_config) {
    configPath = testCase.agent_config;
    agentConfig = loadAgentConfig(testCase.agent_config);
  } else {
    printNoAgentConfigError();
    process.exit(1);
  }

  if (opts.model) {
    if (!opts.json) {
      console.log(formatOverrideLine("model", agentConfig.model ?? "?", opts.model, { colors: stdoutSupportsColor() }));
    }
    agentConfig = { ...agentConfig, model: opts.model };
  }

  if (opts.provider) {
    if (!opts.json) {
      console.log(formatOverrideLine("provider", agentConfig.provider ?? "?", opts.provider, { colors: stdoutSupportsColor() }));
    }
    agentConfig = { ...agentConfig, provider: opts.provider };
  }

  if (opts.temperature !== undefined) {
    if (!opts.json) {
      console.log(formatOverrideLine("temperature", String(agentConfig.temperature ?? "default"), String(opts.temperature), { colors: stdoutSupportsColor() }));
    }
    agentConfig = { ...agentConfig, temperature: opts.temperature };
  }

  if (opts.maxSteps !== undefined) {
    const before = String(agentConfig.maxSteps ?? agentConfig.max_steps ?? "default");
    if (!opts.json) {
      console.log(formatOverrideLine("steps", before, String(opts.maxSteps), { colors: stdoutSupportsColor() }));
    }
    agentConfig = { ...agentConfig, max_steps: opts.maxSteps, maxSteps: opts.maxSteps };
  }

  if (opts.stepTimeout !== undefined) {
    if (!opts.json) {
      console.log(formatOverrideLine("step_timeout_ms", String(agentConfig.step_timeout_ms ?? 120000), String(opts.stepTimeout), { colors: stdoutSupportsColor() }));
    }
    agentConfig = { ...agentConfig, step_timeout_ms: opts.stepTimeout };
  }

  if (opts.dryRun) {
    const summary = {
      testCase: testCase.name,
      testCasePath: resolvedPath,
      agentConfig: agentConfig.name,
      model: agentConfig.model ?? null,
      provider: agentConfig.provider ?? null,
      temperature: agentConfig.temperature ?? null,
      maxSteps: agentConfig.max_steps ?? agentConfig.maxSteps ?? null,
      stepTimeoutMs: agentConfig.step_timeout_ms ?? null,
      sandbox: opts.sandbox ?? "docker",
      repeat: opts.repeat && opts.repeat > 1 ? opts.repeat : 1,
    };
    if (opts.json) {
      console.log(JSON.stringify(summary));
    } else {
      console.log(`\nRun dry run -- 1 test case\n`);
      console.log(`  Test case:    ${summary.testCase}`);
      console.log(`  Path:         ${summary.testCasePath}`);
      console.log(`  Config:       ${summary.agentConfig}`);
      console.log(`  Model:        ${summary.model ?? "(from config)"}`);
      if (summary.provider) console.log(`  Provider:     ${summary.provider}`);
      if (summary.temperature !== null) console.log(`  Temperature:  ${summary.temperature}`);
      if (summary.maxSteps !== null) console.log(`  Max steps:    ${summary.maxSteps}`);
      if (summary.stepTimeoutMs !== null) console.log(`  Step timeout: ${summary.stepTimeoutMs}ms`);
      console.log(`  Sandbox:      ${summary.sandbox}`);
      if (summary.repeat > 1) console.log(`  Repeat:       ${summary.repeat}x`);
      console.log(`\nRe-run without --dry-run to execute.`);
    }
    return;
  }

  const adapterName = opts.adapter ?? "ai-sdk";
  if (adapterName === "ai-sdk") {
    const missingKey = missingApiKeyForAgentConfig(agentConfig);
    if (missingKey) {
      const envPath = findEnvFile();
      printMissingApiKeyError({
        envVar: missingKey,
        envPath,
        testCaseName: testCase.name,
        configPath,
        model: agentConfig.model,
      });
      process.exit(1);
    }
  }

  const sandboxProvider = resolveSandbox(opts.sandbox ?? "docker");
  const adapter = resolveAdapter(adapterName);
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

    if (!opts.json) {
      console.log(
        formatSuccess(`repeating ${testCase.name} ×${repeat} · ${agentConfig.model}`, {
          colors: stdoutSupportsColor(),
        }) + "\n",
      );
    }
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

    if (opts.saveBaseline) {
      const runIds = results.map((r) => r.runId);
      const snapshot = await buildBaselineSnapshotFromRunIds(db, runIds, { configs: [agentConfig.id || agentConfig.name] });
      const savedPath = saveBaselineSnapshot(snapshot, opts.saveBaseline);
      console.log(formatSuccess(`baseline saved to ${savedPath}`, { colors: stdoutSupportsColor() }));
    }

    if (opts.failOnFailure && passed < results.length) {
      console.log(`\nInspect: agr trace --last --test-case ${testCase.name}  |  agr list --plain --failed`);
      process.exit(1);
    }
    console.log(`\nNext: agr trace --last --test-case ${testCase.name}  |  agr bench ${testCase.name}`);
    process.exit(0);
  }

  if (opts.untilPass) {
    const maxAttempts = opts.maxAttempts ?? 5;
    await saveTestCase(db, testCaseToDbRow(testCase));
    await saveAgentConfig(db, {
      id: agentConfig.id || agentConfig.name,
      name: agentConfig.name,
      model: agentConfig.model,
      maxSteps: agentConfig.max_steps,
      temperature: agentConfig.temperature,
      createdAt: Math.floor(Date.now() / 1000),
    });
    if (!opts.json) {
      console.log(
        formatSuccess(`until-pass ${testCase.name} · ${agentConfig.model} (max ${maxAttempts} attempts)`, {
          colors: stdoutSupportsColor(),
        }) + "\n",
      );
    }
    const results: Array<{ passed: boolean | null; costUsd: number; durationMs: number; runId: string; error?: string }> = [];
    for (let i = 0; i < maxAttempts; i++) {
      const runId = randomUUID();
      if (!opts.json) process.stdout.write(`  [${i + 1}/${maxAttempts}] running...`);
      let result: { passed: boolean | null; costUsd: number; durationMs: number } | null = null;
      try {
        result = await runSingle({
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
          process.stdout.write(`\r  [${i + 1}/${maxAttempts}] ${status.padEnd(5)} $${result.costUsd.toFixed(4)}  ${formatDuration(result.durationMs)}  ${runId.slice(0, 8)}\n`);
        }
        results.push({ passed: result.passed, costUsd: result.costUsd, durationMs: result.durationMs, runId });
        if (result.passed === true) break;
      } catch (err: any) {
        if (!opts.json) process.stdout.write(`\r  [${i + 1}/${maxAttempts}] ERROR ${err.message}\n`);
        results.push({ passed: null, costUsd: 0, durationMs: 0, runId, error: err.message });
      }
    }
    const didPass = results.some((r) => r.passed === true);
    const totalCost = results.reduce((s, r) => s + r.costUsd, 0);
    if (opts.json) {
      console.log(JSON.stringify({
        testCaseId: testCase.name,
        agentConfigId: agentConfig.id || agentConfig.name,
        model: agentConfig.model,
        passed: didPass,
        attempts: results.length,
        maxAttempts,
        totalCostUsd: totalCost,
        runs: results,
      }));
      if (!didPass && opts.failOnFailure) process.exit(1);
      process.exit(0);
    }
    console.log(`\nUntil-pass summary (${results.length} attempt(s)):`);
    if (didPass) {
      console.log(`  PASS on attempt ${results.findIndex((r) => r.passed === true) + 1} of ${results.length}`);
    } else {
      console.log(`  FAIL: did not pass in ${maxAttempts} attempt(s)`);
    }
    console.log(`  Total cost: $${totalCost.toFixed(4)}`);
    const lastRunId = results[results.length - 1]?.runId ?? "";
    console.log(`\nNext: agr trace ${lastRunId}  |  agr status --flaky --test-case ${testCase.name}`);
    if (!didPass && opts.failOnFailure) process.exit(1);
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

  printRunContext({
    testCaseName: testCase.name,
    configPath,
    model: agentConfig.model ?? "?",
  });
  printRunStartLine();

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

    if (opts.report && !opts.output && !opts.reportDir) {
      console.warn(formatWarning(`--report ${opts.report} has no effect without --output <path> or --report-dir <dir>`, { colors: stdoutSupportsColor() }));
    }

    if (opts.report && (opts.output || opts.reportDir)) {
      const benchSummary = computeBenchmarkSummary([result], [agentConfig.id || agentConfig.name]);
      const report = await buildReportFromRunIds(
        db,
        [runId],
        benchSummary,
        [agentConfig],
        !!opts.reportIncludeTraces,
      );
      const outputPath = opts.output ?? buildTimestampedReportPath(opts.reportDir!, opts.report, "run");
      const path = writeReport(report, opts.report, outputPath);
      console.log(formatSuccess(`report written to ${path}`, { colors: stdoutSupportsColor() }));
    }

    if (opts.saveBaseline) {
      const snapshot = await buildBaselineSnapshotFromRunIds(db, [runId], { configs: [agentConfig.id || agentConfig.name] });
      const savedPath = saveBaselineSnapshot(snapshot, opts.saveBaseline);
      console.log(formatSuccess(`baseline saved to ${savedPath}`, { colors: stdoutSupportsColor() }));
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
    printNextSteps([`agr bench ${testCase.name}`, `agr trace ${runId}`, "agr trace --last --quality"]);
  } else {
    printNextSteps([`agr trace ${runId}`, "agr trace --last --quality", "agr trace --last --tools"]);
  }

  process.exit(exitCode);
}
