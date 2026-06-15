import type { AgrDb } from "@agentgrader/store";
import { addTrace, createRun, updateRun } from "@agentgrader/store";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type { AgentAdapter, AgentResult } from "../adapters/agent-adapter";
import type { Scorer } from "../adapters/scorer";
import type { SandboxHandle, SandboxProvider } from "../adapters/sandbox-provider";
import type { AgentConfig } from "../schema/agent-config";
import type { TestCase } from "../schema/test-case";
import type { StepEvent, Trace } from "../schema/trace";
import { AssertionScorer } from "../scorers/assertion-scorer";
import { CommandScorer } from "../scorers/command-scorer";
import { DiffScorer } from "../scorers/diff-scorer";
import { LocalizationScorer } from "../scorers/localization-scorer";
import { RegressionScorer } from "../scorers/regression-scorer";
import { getOrComputeBaseline } from "./baseline";
import { buildSkillsPromptAddendum, discoverSkillsForToolkits } from "./skills";
import { wasCommandUsed } from "./tool-usage";

export interface RunSingleInput {
  testCase: TestCase;
  agentConfig: AgentConfig;
  adapter: AgentAdapter;
  sandboxProvider: SandboxProvider;
  db?: AgrDb;
  runId: string;
  /**
   * additive, non-blocking scorers (e.g. staticqualityscorer,
   * llmjudgescorer) run after the core pass/fail scoring. their results
   * never affect `passed`/`score` - each scorer's `scorerresult` is merged
   * into `metrics` under its own `name`.
   */
  extraScorers?: Scorer[];
  /** links this run to an optimizer matrix run, if any */
  matrixId?: string;
  onStep?: (step: StepEvent) => void;
}

export interface RunSingleResult {
  runId: string;
  passed: boolean;
  score?: number;
  stepsCount: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
  error?: string;
  finalDiff?: string;
  metrics?: Record<string, any>;
}

export async function runSingle(input: RunSingleInput): Promise<RunSingleResult> {
  const { testCase, agentConfig, adapter, sandboxProvider, db, runId, extraScorers, matrixId } = input;
  const startTime = Date.now();
  let sandbox: any = null;
  let passed = false;
  let score = 0;
  let stepsCount = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;
  let durationMs = 0;
  let errorMsg: string | undefined;
  let finalDiff = "";
  let agentDiff = "";
  let agentResult: AgentResult | undefined;
  const metrics: Record<string, any> = {};
  const emittedSteps: StepEvent[] = [];

  // write the initial run row so the dashboard can track it
  if (db) {
    await createRun(db, {
      id: runId,
      testCaseId: testCase.id || testCase.name,
      agentConfigId: agentConfig.id || agentConfig.name,
      sandboxProvider: sandboxProvider.name,
      status: "running",
      matrixId,
      createdAt: Math.floor(startTime / 1000),
    });
  }

  // compute (or load cached) baseline test status for FAIL_TO_PASS/PASS_TO_PASS
  // comparisons
  // run on a pristine copy of the fixture, independent of the
  // sandbox the agent will work in.
  let baseline: Awaited<ReturnType<typeof getOrComputeBaseline>>;
  try {
    baseline = await getOrComputeBaseline({ testCase, sandboxProvider, db });
  } catch (err: any) {
    console.error(`Failed to compute baseline: ${err.message}`);
  }

  // toolkits requested by either the agent config or the test case
  // (e.g. custom CLI tools + Agent Skills docs), deduplicated
  const toolkits = Array.from(
    new Set([...(agentConfig.toolkits ?? []), ...(testCase.toolkits ?? [])]),
  );

  // mastra workflow to sequence: setup → solve → score → cleanup
  const setupSandboxStep = createStep({
    id: "setupSandbox",
    inputSchema: z.any(),
    outputSchema: z.object({}),
    execute: async () => {
      // spin up an isolated docker container with the fixture files
      sandbox = await sandboxProvider.create({
        image: testCase.image,
        gitSnapshot: testCase.fixture,
        toolkits,
      });
      return {};
    },
  });

  const solveStep = createStep({
    id: "solve",
    inputSchema: z.any(),
    outputSchema: z.object({}),
    execute: async () => {
      if (!sandbox) throw new Error("Sandbox not initialized");

      const onStepCallback = (stepEvent: StepEvent) => {
        emittedSteps.push(stepEvent);
        stepsCount++;
        tokensIn += stepEvent.tokensIn || 0;
        tokensOut += stepEvent.tokensOut || 0;
        costUsd += stepEvent.costUsd || 0;
        input.onStep?.(stepEvent);

        if (db) {
          addTrace(db, {
            runId,
            stepIndex: stepEvent.index,
            kind: stepEvent.kind,
            tool: stepEvent.tool,
            tokensIn: stepEvent.tokensIn,
            tokensOut: stepEvent.tokensOut,
            cachedTokens: stepEvent.cachedTokens,
            costUsd: stepEvent.costUsd,
            timestamp: stepEvent.timestamp,
            content: stepEvent.content,
          }).catch((err) => {
            console.error(`Failed to persist trace step: ${err.message}`);
          });
        }
      };

      // surface bundled toolkits' skills (name + description) to the agent,
      // mirroring the "progressive disclosure" model: the full SKILL.md is
      // read on demand once the agent decides a skill is relevant.
      let effectiveConfig = agentConfig;
      if (toolkits.length > 0) {
        try {
          const skills = discoverSkillsForToolkits(toolkits);
          const addendum = buildSkillsPromptAddendum(skills);
          if (addendum) {
            effectiveConfig = {
              ...agentConfig,
              system_prompt: agentConfig.system_prompt
                ? `${agentConfig.system_prompt}\n\n${addendum}`
                : addendum,
            };
          }
        } catch (e: any) {
          console.error(`Failed to build skills prompt addendum: ${e.message}`);
        }
      }

      const result = await adapter.solve({
        prompt: testCase.prompt,
        sandbox,
        config: effectiveConfig,
        onStep: onStepCallback,
      });

      // capture the agent's own diff before we apply any test_patch
      try {
        agentDiff = await sandbox.gitDiff();
      } catch (e: any) {
        console.error(`Failed to capture agent diff: ${e.message}`);
      }
      agentResult = { ...result, finalDiff: agentDiff || result.finalDiff };

      // surface agent-loop errors (e.g. a step_timeout_ms abort) so `agr
      // trace` can distinguish "the agent itself errored before submit"
      // from "the agent finished but its solution failed scoring" - both
      // otherwise look identical (`finished: false`, no score detail).
      if (agentResult.error) {
        metrics.agentError = agentResult.error;
      }

      // apply the (gold) test patch, if configured, so the regression
      // scorer can run against the up-to-date test suite. The agent never
      // sees this patch, it's evaluation-only, mirroring SWE-bench.
      if (testCase.test_patch) {
        try {
          const patchResult = await sandbox.applyPatch(testCase.test_patch);
          metrics.testPatchApply = patchResult;
        } catch (e: any) {
          metrics.testPatchApply = { applied: false, repaired: false, output: e.message };
        }
      }

      return { result };
    },
  });

  const scoreStep = createStep({
    id: "score",
    inputSchema: z.any(),
    outputSchema: z.object({
      passed: z.boolean(),
      detail: z.string(),
      score: z.number(),
    }),
    execute: async () => {
      if (!sandbox) throw new Error("Sandbox not initialized");

      // toolkit-adoption check: did the agent ever invoke each
      // require_tools_before_submit command (e.g. a custom toolkit's
      // run-tests/inspect-code)? Never blocks the run - just annotates
      // metrics["tool-adoption"] so `agr trace`/`agr bench` can surface
      // "configured but unused" toolkit tools.
      if (agentConfig.require_tools_before_submit && agentConfig.require_tools_before_submit.length > 0) {
        const required = agentConfig.require_tools_before_submit;
        const missing = required.filter((name) => !wasCommandUsed(emittedSteps, name));
        metrics["tool-adoption"] = {
          passed: missing.length === 0,
          detail:
            missing.length === 0
              ? `All required tool(s) were used at least once: ${required.join(", ")}`
              : `Missing required tool(s) before submit: ${missing.join(", ")}`,
          required,
          missing,
        };
      }

      // optional, non-gating adoption tracking for toolkit tools that aren't
      // required before submit (e.g. find-usages, show-call-hierarchy). Lets
      // `agr trace --quality` surface adoption trends for new/optional tools
      // without affecting metrics["tool-adoption"] or pass/fail.
      if (agentConfig.track_tools && agentConfig.track_tools.length > 0) {
        const tracked = agentConfig.track_tools;
        const used = tracked.filter((name) => wasCommandUsed(emittedSteps, name));
        const unused = tracked.filter((name) => !used.includes(name));
        metrics["tool-usage"] = {
          tracked,
          used,
          unused,
          detail: `Used ${used.length}/${tracked.length} tracked tool(s): ${used.join(", ") || "(none)"}`,
        };
      }

      // run additive, non-blocking quality scorers first so their results
      // (diff size, lint, LLM judge, ...) are recorded regardless of
      // whether the functional checks below pass or fail.
      if (extraScorers && extraScorers.length > 0 && agentResult) {
        const trace: Trace = { runId, steps: emittedSteps };
        for (const scorer of extraScorers) {
          try {
            metrics[scorer.name] = await scorer.score({
              testCase,
              result: agentResult,
              trace,
              sandbox,
            });
          } catch (e: any) {
            metrics[scorer.name] = { passed: true, detail: `Scorer error: ${e.message}` };
          }
        }
      }

      // if the agent loop itself errored or was aborted (e.g. a
      // `step_timeout_ms` watchdog firing on a stuck provider request), the
      // agent never got a real chance to finish - skip the functional
      // scorers entirely. They run `test_command`/regression checks via
      // `sandbox.exec`, which can itself take minutes (or, pre-timeout,
      // forever) against a half-edited fixture; running them on a run that's
      // already a guaranteed fail just delays `RUN SUMMARY` and risks
      // compounding one hang with another.
      if (agentResult?.error) {
        return {
          passed: false,
          detail: `Agent loop did not complete: ${agentResult.error}`,
          score: 0,
        };
      }

      // run the test suite in the sandbox
      const cmdScorer = new CommandScorer();
      const cmdResult = await cmdScorer.score({
        testCase,
        sandbox,
      });
      metrics.command = { passed: cmdResult.passed, detail: cmdResult.detail };

      if (!cmdResult.passed) {
        return { passed: false, detail: cmdResult.detail, score: 0 };
      }

      // check budget/step limits if any assertions are defined
      const assertScorer = new AssertionScorer();
      const trace: Trace = { runId, steps: emittedSteps };
      const assertResult = await assertScorer.score({
        testCase,
        trace,
      });
      metrics.assertion = { passed: assertResult.passed, detail: assertResult.detail };

      if (!assertResult.passed) {
        return { passed: false, detail: assertResult.detail, score: 0 };
      }

      let overallPassed = true;
      let overallDetail = "All tests passed";

      // FAIL_TO_PASS / PASS_TO_PASS regression check + tamper guard
      const regressionScorer = new RegressionScorer();
      const regressionResult = await regressionScorer.score({
        testCase,
        sandbox,
        baseline: baseline?.statusMap,
      });
      metrics.regression = {
        passed: regressionResult.passed,
        score: regressionResult.score,
        detail: regressionResult.detail,
      };
      if (!regressionResult.passed) {
        overallPassed = false;
        overallDetail = regressionResult.detail;
      }

      // diff scope + file localization (informational - don't fail the run)
      if (agentResult) {
        const diffScorer = new DiffScorer();
        const diffResult = await diffScorer.score({ testCase, result: agentResult });
        metrics.diff = { score: diffResult.score, detail: diffResult.detail };

        const localizationScorer = new LocalizationScorer();
        const localizationResult = await localizationScorer.score({
          testCase,
          result: agentResult,
        });
        metrics.localization = {
          score: localizationResult.score,
          detail: localizationResult.detail,
        };
      }

      if (baseline) {
        metrics.baseline = { cached: baseline.cached, fixtureHash: baseline.fixtureHash };
      }

      return {
        passed: overallPassed,
        detail: overallDetail,
        score: overallPassed ? 100 : 0,
      };
    },
  });

  const cleanupStep = createStep({
    id: "cleanup",
    inputSchema: z.any(),
    outputSchema: z.object({}),
    execute: async () => {
      if (sandbox) {
        try {
          // prefer the diff captured right after solve (before any
          // evaluation-only test_patch was applied); fall back to a fresh
          // diff if that capture failed for some reason.
          finalDiff = agentDiff || (await sandbox.gitDiff());
        } catch (e: any) {
          console.error(`Failed to capture final diff: ${e.message}`);
        }
        try {
          // `destroy()` calls stop/remove on the container, which can hang
          // if the Docker daemon is itself wedged (e.g. by a backlog of
          // stale containers). A run that made it this far should still
          // produce a RUN SUMMARY even if teardown itself stalls - the
          // container is then left for `agr cleanup` to reap later.
          await Promise.race([
            sandbox.destroy(),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("sandbox.destroy() timed out after 60000ms")), 60_000),
            ),
          ]);
        } catch (e: any) {
          console.error(`Failed to clean up sandbox: ${e.message}`);
        }
        sandbox = null;
      }
      return {};
    },
  });

  const workflow = createWorkflow({
    id: `run-single-${runId}`,
    inputSchema: z.any(),
    outputSchema: z.any(),
  })
    .then(setupSandboxStep)
    .then(solveStep)
    .then(scoreStep)
    .then(cleanupStep)
    .commit();

  try {
    const runState = {};
    const run = await workflow.createRun();
    const res = (await run.start({
      inputData: {},
      initialState: runState,
    })) as any;

    const scoreStep = res.steps?.score;
    if (res.status === "success" && scoreStep?.status === "success") {
      const scoreOutput = scoreStep.output;
      passed = scoreOutput?.passed ?? false;
      score = scoreOutput?.score ?? 0;
      errorMsg = scoreOutput?.passed ? undefined : scoreOutput?.detail;
    } else {
      passed = false;
      score = 0;
      errorMsg = res.error?.message ?? "Workflow did not complete successfully";
    }
  } catch (err: any) {
    errorMsg = err.message || "Unknown execution error";
    passed = false;
    // still need to clean up even if something blew up
    if (sandbox) {
      try {
        await sandbox.destroy();
      } catch (e) { }
    }
  }

  durationMs = Date.now() - startTime;

  // update the run row with final results
  if (db) {
    await updateRun(db, runId, {
      status: errorMsg ? "failed" : "completed",
      passed,
      score,
      stepsCount,
      tokensIn,
      tokensOut,
      costUsd,
      durationMs,
      error: errorMsg,
      finalDiff,
      metrics: Object.keys(metrics).length > 0 ? JSON.stringify(metrics) : undefined,
      completedAt: Math.floor(Date.now() / 1000),
    });
  }

  return {
    runId,
    passed,
    score,
    stepsCount,
    tokensIn,
    tokensOut,
    costUsd,
    durationMs,
    error: errorMsg,
    finalDiff,
    metrics,
  };
}
