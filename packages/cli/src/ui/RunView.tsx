import React from "react";
import { Box, Text } from "ink";
import type { StepEvent } from "@agentgrader/core";

export const VERBOSE_CONTENT_MAX = 200;

export function truncateForVerbose(value: string, max = VERBOSE_CONTENT_MAX): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

const MAX_DIFF_LINES = 60;

export interface RunSummary {
  passed: boolean;
  stepsCount: number;
  costUsd: number;
  durationMs: number;
  error?: string;
  cachedTokens: number;
  tokensIn: number;
  metrics?: Record<string, any>;
  finalDiff?: string;
}

export interface RunViewProps {
  testCaseName: string;
  model: string;
  verbose: boolean;
  steps: StepEvent[];
  /** set once the run has finished (success or error) */
  summary?: RunSummary;
  /** set if `runSingle` itself threw */
  runError?: string;
}

function kindColor(kind: StepEvent["kind"]): string {
  switch (kind) {
    case "tool_call":
      return "blue";
    case "tool_result":
      return "green";
    case "thinking":
      return "gray";
    case "message":
      return "white";
    default:
      return "white";
  }
}

function stepLabel(step: StepEvent): string {
  if (step.tool) return `${step.kind}:${step.tool}`;
  return step.kind;
}

function stepContent(step: StepEvent): string | undefined {
  if (!step.content) return undefined;
  return truncateForVerbose(step.content.replace(/\n/g, " "));
}

function formatMetricDetail(label: string, detail: string): string {
  if (/^No .+ configured; skipping/.test(detail)) {
    return `[skip] ${label}: ${detail}`;
  }
  return `${label}: ${detail}`;
}

const StepLine: React.FC<{ step: StepEvent }> = ({ step }) => {
  const content = stepContent(step);
  return (
    <Box>
      <Text>
        <Text color="gray">[{step.index}] </Text>
        <Text color={kindColor(step.kind)} bold>
          {stepLabel(step)}
        </Text>
        {content && <Text color="gray"> {content}</Text>}
      </Text>
    </Box>
  );
};

const DiffView: React.FC<{ diff: string }> = ({ diff }) => {
  const lines = diff.split("\n");
  const truncated = lines.length > MAX_DIFF_LINES;
  const shown = truncated ? lines.slice(0, MAX_DIFF_LINES) : lines;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
      <Text bold color="cyan">
        Diff
      </Text>
      {shown.map((line, i) => {
        let color: string | undefined;
        if (line.startsWith("@@")) {
          color = "cyan";
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          color = "green";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          color = "red";
        }
        return (
          <Text key={i} color={color}>
            {line.length > 0 ? line : " "}
          </Text>
        );
      })}
      {truncated && (
        <Text color="gray">... {lines.length - MAX_DIFF_LINES} more line(s)</Text>
      )}
    </Box>
  );
};

const SummaryView: React.FC<{ summary: RunSummary }> = ({ summary }) => {
  const cacheHitRate =
    summary.tokensIn > 0 ? ((summary.cachedTokens / summary.tokensIn) * 100).toFixed(1) : undefined;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={summary.passed ? "green" : "red"}
      paddingX={1}
      marginTop={1}
    >
      <Text bold color="cyan">
        RUN SUMMARY
      </Text>
      <Box>
        <Text bold>Status:    </Text>
        <Text color={summary.passed ? "green" : "red"} bold>
          {summary.passed ? "PASSED" : "FAILED"}
        </Text>
      </Box>
      <Text>Steps:     {summary.stepsCount}</Text>
      <Text>Cost:      ${summary.costUsd.toFixed(4)}</Text>
      <Text>Duration:  {(summary.durationMs / 1000).toFixed(1)}s</Text>
      {cacheHitRate !== undefined && (
        <Text>
          Prompt cache: {summary.cachedTokens}/{summary.tokensIn} input tokens served from cache (
          {cacheHitRate}%)
        </Text>
      )}
      {summary.error && <Text color="red">Error:     {summary.error}</Text>}
      {summary.metrics?.regression && (
        <Text color={/^No .+ configured; skipping/.test(summary.metrics.regression.detail) ? "yellow" : undefined}>
          {formatMetricDetail("Regression", summary.metrics.regression.detail)}
        </Text>
      )}
      {summary.metrics?.diff && (
        <Text>Diff scope: {summary.metrics.diff.detail.split("\n")[0]}</Text>
      )}
      {summary.metrics?.localization && (
        <Text
          color={
            /^No .+ configured; skipping/.test(summary.metrics.localization.detail)
              ? "yellow"
              : undefined
          }
        >
          {formatMetricDetail("Localization", summary.metrics.localization.detail.split("\n")[0])}
        </Text>
      )}
    </Box>
  );
};

export const RunView: React.FC<RunViewProps> = ({
  testCaseName,
  model,
  verbose,
  steps,
  summary,
  runError,
}) => {
  let runningCost = 0;
  for (const step of steps) {
    runningCost += step.costUsd || 0;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1} flexDirection="column">
        <Text color="cyan" bold>
          AGENTGRADER RUN
        </Text>
        <Text color="gray">
          {testCaseName} (model: {model})
        </Text>
      </Box>

      {verbose ? (
        <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold underline color="yellow">
            Steps
          </Text>
          {steps.length === 0 && !summary && <Text color="gray">Waiting for first step...</Text>}
          {steps.map((step) => (
            <StepLine key={step.index} step={step} />
          ))}
        </Box>
      ) : (
        !summary && (
          <Box>
            <Text color="yellow">running... </Text>
            <Text color="gray">
              steps: {steps.length}, cost: ${runningCost.toFixed(4)}
            </Text>
          </Box>
        )
      )}

      {runError && (
        <Box borderStyle="double" borderColor="red" paddingX={1} marginTop={1}>
          <Text color="red" bold>
            Run failed with error: {runError}
          </Text>
        </Box>
      )}

      {summary && <SummaryView summary={summary} />}
      {summary?.finalDiff && summary.finalDiff.trim().length > 0 && (
        <DiffView diff={summary.finalDiff} />
      )}
    </Box>
  );
};
