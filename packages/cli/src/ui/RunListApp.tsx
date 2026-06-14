import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { EnrichedRun } from "../lib/load-run-list";
import { formatRunStatus, shortRunId } from "../lib/load-run-list";
import { formatAbsoluteTime, formatRelativeTime, formatRunWhen } from "../lib/format-relative-time";
import { DiffPanel, maxDiffScroll } from "./DiffPanel";

type Screen = "list" | "detail" | "compare";
type ComparePhase = "idle" | "pick-a" | "pick-b";

export interface TracePreviewStep {
  stepIndex: number;
  kind: string;
  tool: string | null;
  content: string | null;
}

export interface RunListAppProps {
  runs: EnrichedRun[];
  dbPath: string;
  loadTraces: (runId: string) => Promise<TracePreviewStep[]>;
}

const LIST_WINDOW = 12;
const DETAIL_TRACE_WINDOW = 10;
const DIFF_WINDOW = 18;

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function statusColor(status: string): string {
  if (status === "PASS") return "green";
  if (status === "FAIL" || status === "ERROR") return "red";
  if (status === "RUNNING") return "yellow";
  return "gray";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ensureCursorVisible(cursor: number, scrollTop: number, windowSize: number, total: number): number {
  if (cursor < scrollTop) return cursor;
  if (cursor >= scrollTop + windowSize) return cursor - windowSize + 1;
  if (scrollTop + windowSize > total) return Math.max(0, total - windowSize);
  return scrollTop;
}

const RunListRow: React.FC<{
  run: EnrichedRun;
  selected: boolean;
  marker?: string;
  nowMs: number;
}> = ({ run, selected, marker, nowMs }) => {
  const status = formatRunStatus(run);
  const when = formatRelativeTime(run.createdAt, nowMs);
  return (
    <Box>
      <Text inverse={selected} color={selected ? undefined : statusColor(status)}>
        {marker ?? " "} {status.padEnd(5)} {shortRunId(run.id)} {truncate(run.testCaseName, 22).padEnd(22)}{" "}
        {truncate(run.agentConfigName, 16).padEnd(16)} {truncate(run.agentModel, 18).padEnd(18)}{" "}
        {when.padEnd(16)} ${run.costUsd.toFixed(3).padStart(7)} {String(run.stepsCount).padStart(3)} steps
      </Text>
    </Box>
  );
};

export const RunListApp: React.FC<RunListAppProps> = ({ runs, dbPath, loadTraces }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 120;

  const [screen, setScreen] = useState<Screen>("list");
  const [cursor, setCursor] = useState(0);
  const [listScroll, setListScroll] = useState(0);
  const [detailRun, setDetailRun] = useState<EnrichedRun | null>(null);
  const [detailTraces, setDetailTraces] = useState<TracePreviewStep[]>([]);
  const [detailTraceScroll, setDetailTraceScroll] = useState(0);
  const [detailDiffScroll, setDetailDiffScroll] = useState(0);
  const [compareA, setCompareA] = useState<EnrichedRun | null>(null);
  const [compareB, setCompareB] = useState<EnrichedRun | null>(null);
  const [comparePhase, setComparePhase] = useState<ComparePhase>("idle");
  const [compareScroll, setCompareScroll] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screen !== "detail" || !detailRun) return;
    let cancelled = false;
    loadTraces(detailRun.id).then((steps) => {
      if (!cancelled) {
        setDetailTraces(steps);
        setDetailTraceScroll(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [detailRun, loadTraces, screen]);

  const stackedDiff = columns < 100;
  const compareMaxScroll = useMemo(() => {
    if (!compareA || !compareB) return 0;
    if (stackedDiff) {
      return Math.max(maxDiffScroll(compareA.finalDiff ?? "", DIFF_WINDOW), maxDiffScroll(compareB.finalDiff ?? "", DIFF_WINDOW));
    }
    return maxDiffScroll(compareA.finalDiff ?? "", DIFF_WINDOW);
  }, [compareA, compareB, stackedDiff]);

  const openDetail = (run: EnrichedRun) => {
    setDetailRun(run);
    setDetailDiffScroll(0);
    setDetailTraceScroll(0);
    setScreen("detail");
  };

  const backToList = () => {
    setScreen("list");
    setDetailRun(null);
    setComparePhase("idle");
    setCompareA(null);
    setCompareB(null);
  };

  const startComparePickA = () => {
    setComparePhase("pick-a");
    setCompareA(null);
    setCompareB(null);
  };

  const confirmCompareA = (run: EnrichedRun) => {
    setCompareA(run);
    setComparePhase("pick-b");
  };

  const openCompare = (a: EnrichedRun, b: EnrichedRun) => {
    setCompareA(a);
    setCompareB(b);
    setComparePhase("idle");
    setCompareScroll(0);
    setScreen("compare");
  };

  useInput((input, key) => {
    if (runs.length === 0) {
      if (input === "q" || key.escape) exit();
      return;
    }

    const current = runs[cursor];

    if (screen === "list") {
      if (key.upArrow || input === "k") {
        setCursor((c) => {
          const next = clamp(c - 1, 0, runs.length - 1);
          setListScroll((scroll) => ensureCursorVisible(next, scroll, LIST_WINDOW, runs.length));
          return next;
        });
        return;
      }
      if (key.downArrow || input === "j") {
        setCursor((c) => {
          const next = clamp(c + 1, 0, runs.length - 1);
          setListScroll((scroll) => ensureCursorVisible(next, scroll, LIST_WINDOW, runs.length));
          return next;
        });
        return;
      }
      if (input === "c") {
        startComparePickA();
        return;
      }
      if (key.return) {
        if (comparePhase === "pick-a") {
          confirmCompareA(current);
          return;
        }
        if (comparePhase === "pick-b") {
          if (!compareA) return;
          if (compareA.id === current.id) return;
          openCompare(compareA, current);
          return;
        }
        openDetail(current);
        return;
      }
      if (key.escape) {
        if (comparePhase !== "idle") {
          setComparePhase("idle");
          setCompareA(null);
          return;
        }
        exit();
        return;
      }
      if (input === "q") {
        exit();
      }
      return;
    }

    if (screen === "detail" && detailRun) {
      if (key.escape || input === "b") {
        backToList();
        return;
      }
      if (input === "c") {
        setComparePhase("pick-b");
        setCompareA(detailRun);
        setCompareB(null);
        setScreen("list");
        setCursor(runs.findIndex((r) => r.id === detailRun.id));
        return;
      }
      if (key.upArrow || input === "k") {
        setDetailTraceScroll((s) => clamp(s - 1, 0, Math.max(0, detailTraces.length - DETAIL_TRACE_WINDOW)));
        setDetailDiffScroll((s) => clamp(s - 1, 0, maxDiffScroll(detailRun.finalDiff ?? "", DIFF_WINDOW)));
        return;
      }
      if (key.downArrow || input === "j") {
        setDetailTraceScroll((s) =>
          clamp(s + 1, 0, Math.max(0, detailTraces.length - DETAIL_TRACE_WINDOW)),
        );
        setDetailDiffScroll((s) => clamp(s + 1, 0, maxDiffScroll(detailRun.finalDiff ?? "", DIFF_WINDOW)));
        return;
      }
      if (input === "q") exit();
      return;
    }

    if (screen === "compare" && compareA && compareB) {
      if (key.escape || input === "b") {
        backToList();
        return;
      }
      if (key.upArrow || input === "k") {
        setCompareScroll((s) => clamp(s - 1, 0, compareMaxScroll));
        return;
      }
      if (key.downArrow || input === "j") {
        setCompareScroll((s) => clamp(s + 1, 0, compareMaxScroll));
        return;
      }
      if (input === "q") exit();
    }
  });

  const visibleRuns = runs.slice(listScroll, listScroll + LIST_WINDOW);
  const compareMarker = (run: EnrichedRun): string | undefined => {
    if (comparePhase === "idle") return undefined;
    if (compareA?.id === run.id) return "A";
    if (comparePhase === "pick-b" && compareA && compareA.id !== run.id) return " ";
    return undefined;
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1} flexDirection="column">
        <Text color="cyan" bold>
          AGENTGRADER RUN HISTORY
        </Text>
        <Text color="gray">{dbPath}</Text>
      </Box>

      {runs.length === 0 ? (
        <Box flexDirection="column">
          <Text color="yellow">No runs found in the database.</Text>
          <Text color="gray">Run `agr run` or `agr bench` first, then reopen `agr list`.</Text>
          <Text color="gray">Press q to quit.</Text>
        </Box>
      ) : screen === "list" ? (
        <Box flexDirection="column">
          {comparePhase !== "idle" && (
            <Box marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}>
              <Text color="yellow" bold>
                Diff compare:{" "}
                {comparePhase === "pick-a"
                  ? "pick run A (Enter), Esc to cancel"
                  : `A=${shortRunId(compareA!.id)} ${truncate(compareA!.agentConfigName, 20)} - pick run B (Enter)`}
              </Text>
            </Box>
          )}

          <Box marginBottom={1}>
            <Text bold color="cyan">
              {"  Status Run     Test Case              Agent            Model               When             Cost Steps"}
            </Text>
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            {visibleRuns.map((run, index) => (
              <RunListRow
                key={run.id}
                run={run}
                selected={listScroll + index === cursor}
                marker={compareMarker(run)}
                nowMs={nowMs}
              />
            ))}
          </Box>

          <Text color="gray">
            Showing {listScroll + 1}-{Math.min(listScroll + LIST_WINDOW, runs.length)} of {runs.length} runs
          </Text>
          <Text color="gray">
            Enter open | c compare | ↑↓/jk move | q quit
          </Text>
        </Box>
      ) : screen === "detail" && detailRun ? (
        <Box flexDirection="column">
          <Box borderStyle="double" borderColor={detailRun.passed ? "green" : "red"} paddingX={1} marginBottom={1}>
            <Text bold color="cyan">
              RUN DETAIL
            </Text>
            <Text>
              ID: {detailRun.id}
            </Text>
            <Text>
              When: {formatRunWhen(detailRun.createdAt, nowMs)}
            </Text>
            <Text>
              Test case: {detailRun.testCaseName} ({detailRun.testCaseId})
            </Text>
            <Text>
              Agent: {detailRun.agentConfigName} ({detailRun.agentModel})
            </Text>
            <Text>
              Sandbox: {detailRun.sandboxProvider}
              {detailRun.matrixId ? ` | matrix: ${truncate(detailRun.matrixId, 24)}` : ""}
            </Text>
            <Text color={statusColor(formatRunStatus(detailRun))} bold>
              Status: {formatRunStatus(detailRun)} | ${detailRun.costUsd.toFixed(4)} |{" "}
              {(detailRun.durationMs / 1000).toFixed(1)}s | {detailRun.stepsCount} steps
            </Text>
            {detailRun.error && <Text color="red">Error: {detailRun.error}</Text>}
          </Box>

          <DiffPanel
            diff={detailRun.finalDiff ?? ""}
            title="Agent diff"
            scrollOffset={detailDiffScroll}
            maxVisibleLines={DIFF_WINDOW}
          />

          <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
            <Text bold color="cyan">
              Trace preview
            </Text>
            {detailTraces.length === 0 ? (
              <Text color="gray">(no steps recorded)</Text>
            ) : (
              detailTraces
                .slice(detailTraceScroll, detailTraceScroll + DETAIL_TRACE_WINDOW)
                .map((step) => {
                  const label = step.tool ? `${step.kind}:${step.tool}` : step.kind;
                  const preview = step.content
                    ? truncate(step.content.replace(/\n/g, " "), 80)
                    : "";
                  return (
                    <Text key={step.stepIndex}>
                      <Text color="gray">[{step.stepIndex}] </Text>
                      <Text color="blue">{label}</Text>
                      {preview && <Text color="gray"> {preview}</Text>}
                    </Text>
                  );
                })
            )}
            {detailTraces.length > DETAIL_TRACE_WINDOW && (
              <Text color="gray">
                Trace lines {detailTraceScroll + 1}-
                {Math.min(detailTraceScroll + DETAIL_TRACE_WINDOW, detailTraces.length)} of {detailTraces.length}
              </Text>
            )}
          </Box>

          <Box marginTop={1}>
            <Text color="gray">
              c compare from this run | ↑↓ scroll diff/trace | b/Esc back | q quit
            </Text>
          </Box>
        </Box>
      ) : screen === "compare" && compareA && compareB ? (
        <Box flexDirection="column">
          <Box borderStyle="double" borderColor="cyan" paddingX={1} marginBottom={1} flexDirection="column">
            <Text bold color="cyan">
              AGENT DIFF COMPARE
            </Text>
            {compareA.testCaseId !== compareB.testCaseId && (
              <Text color="yellow">
                Warning: different test cases. Diff comparison may not be meaningful.
              </Text>
            )}
            <Text>
              A: {shortRunId(compareA.id)} | {compareA.agentConfigName} | {formatRunStatus(compareA)} |{" "}
              {formatAbsoluteTime(compareA.createdAt)}
            </Text>
            <Text>
              B: {shortRunId(compareB.id)} | {compareB.agentConfigName} | {formatRunStatus(compareB)} |{" "}
              {formatAbsoluteTime(compareB.createdAt)}
            </Text>
          </Box>

          {stackedDiff ? (
            <Box flexDirection="column">
              <DiffPanel
                diff={compareA.finalDiff ?? ""}
                title={`Run A (${shortRunId(compareA.id)})`}
                scrollOffset={compareScroll}
                maxVisibleLines={DIFF_WINDOW}
              />
              <Box marginTop={1}>
                <DiffPanel
                  diff={compareB.finalDiff ?? ""}
                  title={`Run B (${shortRunId(compareB.id)})`}
                  scrollOffset={compareScroll}
                  maxVisibleLines={DIFF_WINDOW}
                />
              </Box>
            </Box>
          ) : (
            <Box flexDirection="row">
              <Box width="50%" marginRight={1}>
                <DiffPanel
                  diff={compareA.finalDiff ?? ""}
                  title={`Run A (${shortRunId(compareA.id)})`}
                  scrollOffset={compareScroll}
                  maxVisibleLines={DIFF_WINDOW}
                />
              </Box>
              <Box width="50%">
                <DiffPanel
                  diff={compareB.finalDiff ?? ""}
                  title={`Run B (${shortRunId(compareB.id)})`}
                  scrollOffset={compareScroll}
                  maxVisibleLines={DIFF_WINDOW}
                />
              </Box>
            </Box>
          )}

          <Box marginTop={1}>
            <Text color="gray">
              GitHub-style diff colors: green added, red removed, cyan hunks | ↑↓ scroll | b/Esc back | q quit
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};
