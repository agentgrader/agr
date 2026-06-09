import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { TestCase } from "../schema/test-case";
import type { AgentConfig } from "../schema/agent-config";
import type { AgentAdapter } from "../adapters/agent-adapter";
import type { SandboxProvider } from "../adapters/sandbox-provider";
import type { CrucibleDb } from "@crucible-agr/store";
import { runSingle, type RunSingleResult } from "./run-single";
import { randomUUID } from "crypto";

export interface BenchmarkInput {
  testCases: TestCase[];
  agentConfigs: AgentConfig[];
  adapter: AgentAdapter;
  sandboxProvider: SandboxProvider;
  db?: CrucibleDb;
  concurrency?: number;
  onRunUpdate?: (
    run: RunSingleResult & {
      testCaseId: string;
      agentConfigId: string;
      status: "running" | "completed" | "failed";
    }
  ) => void;
}

export interface BenchmarkResult {
  runs: RunSingleResult[];
}

export async function runBenchmark(input: BenchmarkInput): Promise<BenchmarkResult> {
  const { testCases, agentConfigs, adapter, sandboxProvider, db, concurrency = 2, onRunUpdate } = input;

  const generateCombinationsStep = createStep({
    id: "generateCombinations",
    inputSchema: z.any(),
    outputSchema: z.array(z.any()),
    execute: async ({ getInitData }) => {
      const initData = getInitData<{ testCases: TestCase[]; agentConfigs: AgentConfig[] }>();
      const combinations = [];
      for (const tc of initData.testCases) {
        for (const config of initData.agentConfigs) {
          combinations.push({
            testCase: tc,
            agentConfig: config,
          });
        }
      }
      return combinations;
    },
  });

  const executeSingleRunStep = createStep({
    id: "executeSingleRun",
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ inputData, requestContext }) => {
      const { testCase, agentConfig } = inputData as { testCase: TestCase; agentConfig: AgentConfig };
      
      // RequestContext can be a Mastra RequestContext wrapper, a Map, or a plain object
      const ctx = (requestContext as any)?.context || requestContext;
      const getVal = (key: string) => {
        if (ctx instanceof Map) return ctx.get(key);
        if (ctx && typeof ctx === "object" && key in ctx) return ctx[key];
        if (typeof ctx?.get === "function") return ctx.get(key);
        return undefined;
      };

      const adapter = getVal("adapter");
      const sandboxProvider = getVal("sandboxProvider");
      const db = getVal("db");
      const onRunUpdate = getVal("onRunUpdate");

      const runId = randomUUID();

      if (onRunUpdate) {
        onRunUpdate({
          runId,
          testCaseId: testCase.id || testCase.name,
          agentConfigId: agentConfig.id || agentConfig.name,
          status: "running",
          passed: false,
          stepsCount: 0,
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          durationMs: 0,
        });
      }

      try {
        const res = await runSingle({
          testCase,
          agentConfig,
          adapter,
          sandboxProvider,
          db,
          runId,
        });

        if (onRunUpdate) {
          onRunUpdate({
            ...res,
            testCaseId: testCase.id || testCase.name,
            agentConfigId: agentConfig.id || agentConfig.name,
            status: res.error ? "failed" : "completed",
          });
        }

        return res;
      } catch (err: any) {
        const failedResult: RunSingleResult = {
          runId,
          passed: false,
          stepsCount: 0,
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          durationMs: 0,
          error: err.message || "Failed during execution",
        };

        if (onRunUpdate) {
          onRunUpdate({
            ...failedResult,
            testCaseId: testCase.id || testCase.name,
            agentConfigId: agentConfig.id || agentConfig.name,
            status: "failed",
          });
        }

        return failedResult;
      }
    },
  });

  const workflow = createWorkflow({
    id: `benchmark-orchestrator-${randomUUID()}`,
    inputSchema: z.any(),
    outputSchema: z.any(),
  })
    .then(generateCombinationsStep)
    .foreach(executeSingleRunStep, { concurrency })
    .commit();

  const runState = {};
  const executionContext = new Map<string, any>([
    ["adapter", adapter],
    ["sandboxProvider", sandboxProvider],
    ["db", db],
    ["onRunUpdate", onRunUpdate],
  ]);

  const run = await workflow.createRun();
  const res = (await run.start({
    inputData: { testCases, agentConfigs },
    initialState: runState,
    requestContext: executionContext as any,
  })) as any;

  const rawRuns = res.results?.executeSingleRunStepResult || [];
  return {
    runs: Array.isArray(rawRuns) ? rawRuns : [],
  };
}
