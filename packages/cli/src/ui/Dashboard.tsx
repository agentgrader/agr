import React from "react";
import { Box, Text } from "ink";

export interface RunState {
  runId: string;
  testCaseId: string;
  agentConfigId: string;
  status: "running" | "completed" | "failed";
  passed: boolean;
  stepsCount: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
  error?: string;
}

export interface DashboardProps {
  runs: Record<string, RunState>;
  testCases: string[];
  configs: string[];
  isFinished: boolean;
}

const CONFIG_COL_WIDTH = 24;
const CONFIG_LABEL_MAX = 20;

function truncateLabel(name: string, max = CONFIG_LABEL_MAX): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export const Dashboard: React.FC<DashboardProps> = ({ runs, testCases, configs, isFinished }) => {
  let totalCost = 0;
  let totalSteps = 0;
  let passedCount = 0;
  let completedCount = 0;

  for (const run of Object.values(runs)) {
    totalCost += run.costUsd || 0;
    totalSteps += run.stepsCount || 0;
    if (run.status === "completed" || run.status === "failed") {
      completedCount++;
      if (run.passed) passedCount++;
    }
  }

  const totalRuns = testCases.length * configs.length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1} flexDirection="column">
        <Text color="cyan" bold>
          🔥 AGENTGRADER BENCHMARK 🔥
        </Text>
        <Text color="gray">
          Docker Sandboxes • Parallel Execution • Mastra Orchestration
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold>Progress: </Text>
        <Text color="yellow">
          {completedCount} / {totalRuns} completed
        </Text>
        <Text> | </Text>
        <Text bold>Passed: </Text>
        <Text color="green">
          {passedCount} / {completedCount || 0} solves
        </Text>
        <Text> | </Text>
        <Text bold>Total Cost: </Text>
        <Text color="magenta">${totalCost.toFixed(4)}</Text>
      </Box>

      {!isFinished && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold underline color="yellow">
            Active Runs:
          </Text>
          {Object.values(runs)
            .filter((r) => r.status === "running")
            .map((r) => (
              <Box key={r.runId} marginLeft={2}>
                <Text color="yellow">●</Text>
                <Text bold> {r.testCaseId}</Text>
                <Text color="gray"> with </Text>
                <Text color="blue" wrap="truncate-end">
                  {truncateLabel(r.agentConfigId)}
                </Text>
                <Text color="gray"> (Steps: {r.stepsCount}, Cost: ${r.costUsd.toFixed(4)})</Text>
              </Box>
            ))}
          {Object.values(runs).filter((r) => r.status === "running").length === 0 && (
            <Box marginLeft={2}>
              <Text color="gray">No active runs (waiting or queuing)...</Text>
            </Box>
          )}
        </Box>
      )}

      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
        <Box flexDirection="row" marginBottom={1}>
          <Box width={25}>
            <Text bold color="cyan">
              Test Case
            </Text>
          </Box>
          {configs.map((cfg) => (
            <Box key={cfg} width={CONFIG_COL_WIDTH}>
              <Text bold color="blue" wrap="truncate-end">
                {truncateLabel(cfg)}
              </Text>
            </Box>
          ))}
        </Box>

        {testCases.map((tc) => (
          <Box key={tc} flexDirection="row">
            <Box width={25}>
              <Text wrap="truncate-end">{tc}</Text>
            </Box>
            {configs.map((cfg) => {
              const key = `${tc}_${cfg}`;
              const run = runs[key];

              if (!run) {
                return (
                  <Box key={cfg} width={CONFIG_COL_WIDTH}>
                    <Text color="gray">queued</Text>
                  </Box>
                );
              }

              if (run.status === "running") {
                return (
                  <Box key={cfg} width={CONFIG_COL_WIDTH}>
                    <Text color="yellow">running...</Text>
                  </Box>
                );
              }

              if (run.status === "failed" || !run.passed) {
                const seconds = (run.durationMs / 1000).toFixed(1);
                return (
                  <Box key={cfg} width={CONFIG_COL_WIDTH}>
                    <Text color="red" wrap="truncate-end">
                      ✗ {seconds}s (${run.costUsd.toFixed(3)})
                    </Text>
                  </Box>
                );
              }

              const seconds = (run.durationMs / 1000).toFixed(1);
              return (
                <Box key={cfg} width={CONFIG_COL_WIDTH}>
                  <Text color="green" wrap="truncate-end">
                    ✓ {seconds}s (${run.costUsd.toFixed(3)})
                  </Text>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      {isFinished && (
        <Box marginTop={1} flexDirection="column" borderStyle="double" borderColor="green" padding={1}>
          <Text color="green" bold>
            Benchmark finished successfully!
          </Text>
          <Text>Total runs executed: {totalRuns}</Text>
          <Text>
            Successful solves: {passedCount} ({((passedCount / totalRuns) * 100).toFixed(0)}%)
          </Text>
          <Text>Total model API cost: ${totalCost.toFixed(4)}</Text>
          <Text>Average steps per run: {(totalSteps / totalRuns).toFixed(1)}</Text>
        </Box>
      )}
    </Box>
  );
};
