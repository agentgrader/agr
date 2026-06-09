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

export const Dashboard: React.FC<DashboardProps> = ({ runs, testCases, configs, isFinished }) => {
  // Compute totals
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
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1} flexDirection="column">
        <Text color="cyan" bold>
          🔥 CRUCIBLE BENCHMARK RUNNER 🔥
        </Text>
        <Text color="gray">
          Docker Sandboxes • Parallel Execution • Mastra Orchestration
        </Text>
      </Box>

      {/* Progress Tally */}
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

      {/* Live Active Runs List */}
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
                <Text color="blue">{r.agentConfigId}</Text>
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

      {/* Results Matrix Table */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
        {/* Table Header */}
        <Box flexDirection="row" marginBottom={1}>
          <Box width={25}>
            <Text bold color="cyan">Test Case</Text>
          </Box>
          {configs.map((cfg) => (
            <Box key={cfg} width={20}>
              <Text bold color="blue">{cfg}</Text>
            </Box>
          ))}
        </Box>

        {/* Table Rows */}
        {testCases.map((tc) => (
          <Box key={tc} flexDirection="row">
            <Box width={25}>
              <Text>{tc}</Text>
            </Box>
            {configs.map((cfg) => {
              const key = `${tc}_${cfg}`;
              const run = runs[key];

              if (!run) {
                return (
                  <Box key={cfg} width={20}>
                    <Text color="gray">queued</Text>
                  </Box>
                );
              }

              if (run.status === "running") {
                return (
                  <Box key={cfg} width={20}>
                    <Text color="yellow">running...</Text>
                  </Box>
                );
              }

              if (run.status === "failed" || !run.passed) {
                const seconds = (run.durationMs / 1000).toFixed(1);
                return (
                  <Box key={cfg} width={20}>
                    <Text color="red">✗ {seconds}s (${run.costUsd.toFixed(3)})</Text>
                  </Box>
                );
              }

              const seconds = (run.durationMs / 1000).toFixed(1);
              return (
                <Box key={cfg} width={20}>
                  <Text color="green">✓ {seconds}s (${run.costUsd.toFixed(3)})</Text>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Footer / Summary */}
      {isFinished && (
        <Box marginTop={1} flexDirection="column" borderStyle="double" borderColor="green" padding={1}>
          <Text color="green" bold>
            Benchmark finished successfully!
          </Text>
          <Text>Total runs executed: {totalRuns}</Text>
          <Text>Successful solves: {passedCount} ({((passedCount / totalRuns) * 100).toFixed(0)}%)</Text>
          <Text>Total model API cost: ${totalCost.toFixed(4)}</Text>
          <Text>Average steps per run: {(totalSteps / totalRuns).toFixed(1)}</Text>
        </Box>
      )}
    </Box>
  );
};
