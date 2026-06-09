import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { TestCase } from "../schema/test-case";
import type { AgentConfig } from "../schema/agent-config";
import type { AgentAdapter } from "../adapters/agent-adapter";
import type { SandboxProvider, SandboxHandle } from "../adapters/sandbox-provider";
import type { CrucibleDb } from "@crucible-agr/store";
import { createRun, updateRun, addTrace } from "@crucible-agr/store";
import { CommandScorer } from "../scorers/command-scorer";
import { AssertionScorer } from "../scorers/assertion-scorer";
import type { StepEvent, Trace } from "../schema/trace";

export interface RunSingleInput {
  testCase: TestCase;
  agentConfig: AgentConfig;
  adapter: AgentAdapter;
  sandboxProvider: SandboxProvider;
  db?: CrucibleDb;
  runId: string;
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
}

export async function runSingle(input: RunSingleInput): Promise<RunSingleResult> {
  const { testCase, agentConfig, adapter, sandboxProvider, db, runId } = input;
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
  const emittedSteps: StepEvent[] = [];

  // write the initial run row so the dashboard can track it
  if (db) {
    await createRun(db, {
      id: runId,
      testCaseId: testCase.id || testCase.name,
      agentConfigId: agentConfig.id || agentConfig.name,
      sandboxProvider: sandboxProvider.name,
      status: "running",
      createdAt: Math.floor(startTime / 1000),
    });
  }

  // mastra workflow to sequence: setup → solve → score → cleanup
  const setupSandboxStep = createStep({
    id: "setupSandbox",
    inputSchema: z.any(),
    outputSchema: z.object({}),
    execute: async () => {
      // spin up an isolated docker container with the fixture files
      sandbox = await sandboxProvider.create({
        gitSnapshot: testCase.fixture,
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

        if (db) {
          addTrace(db, {
            runId,
            stepIndex: stepEvent.index,
            kind: stepEvent.kind,
            tool: stepEvent.tool,
            tokensIn: stepEvent.tokensIn,
            tokensOut: stepEvent.tokensOut,
            costUsd: stepEvent.costUsd,
            timestamp: stepEvent.timestamp,
            content: stepEvent.content,
          }).catch((err) => {
            console.error(`Failed to persist trace step: ${err.message}`);
          });
        }
      };

      const result = await adapter.solve({
        prompt: testCase.prompt,
        sandbox,
        config: agentConfig,
        onStep: onStepCallback,
      });

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
      
      // run the test suite in the sandbox
      const cmdScorer = new CommandScorer();
      const cmdResult = await cmdScorer.score({
        testCase,
        sandbox,
      });

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

      if (!assertResult.passed) {
        return { passed: false, detail: assertResult.detail, score: 0 };
      }

      return { passed: true, detail: "All tests passed", score: 100 };
    },
  });

  const cleanupStep = createStep({
    id: "cleanup",
    inputSchema: z.any(),
    outputSchema: z.object({}),
    execute: async () => {
      if (sandbox) {
        try {
          finalDiff = await sandbox.gitDiff();
          await sandbox.destroy();
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

    const scoreResults = res.results?.score;
    passed = scoreResults?.passed ?? false;
    score = scoreResults?.score ?? 0;
    errorMsg = scoreResults?.passed ? undefined : scoreResults?.detail;
  } catch (err: any) {
    errorMsg = err.message || "Unknown execution error";
    passed = false;
    // still need to clean up even if something blew up
    if (sandbox) {
      try {
        await sandbox.destroy();
      } catch (e) {}
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
  };
}
