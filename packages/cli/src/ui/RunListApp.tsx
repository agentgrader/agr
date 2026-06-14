import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { EnrichedRun } from "../lib/load-run-list";
import { formatRunStatus, shortRunId } from "../lib/load-run-list";
import { formatAbsoluteTime, formatCompactWhen, formatRunWhen } from "../lib/format-relative-time";
import {
  clearTerminalScreen,
  computeListColumnLayout,
  formatListHeader,
  formatListRow,
} from "../lib/list-table-layout";
import { DiffPanel, maxDiffScroll } from "./DiffPanel";

type Screen = "list" | "detail" | "compare";
type ComparePhase = "idle" | "pick-a" | "pick-b";
type DetailPane = "diff" | "trace";

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

const DETAIL_TRACE_WINDOW = 10;
const DIFF_WINDOW = 18;
const MIN_LIST_WINDOW = 8;
const MAX_LIST_WINDOW = 30;

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

function formatTraceLine(step: TracePreviewStep, maxWidth: number): string {
  const label = step.tool ? `${step.kind}:${step.tool}` : step.kind;
  const preview = step.content ? step.content.replace(/\s+/g, " ").trim() : "";
  const line = preview ? `[${step.stepIndex}] ${label} ${preview}` : `[${step.stepIndex}] ${label}`;
  return truncate(line, maxWidth);
}

function traceFooterText(total: number, scroll: number, windowSize: number): string {
  if (total === 0) return " ";
  const start = scroll + 1;
  const end = Math.min(scroll + windowSize, total);
  return `Steps ${start}-${end} of ${total}`;
}

const DetailRow: React.FC<{
  label: string;
  lines: string[];
  valueColor?: string;
  bold?: boolean;
}> = ({ label, lines, valueColor, bold }) => (
  <Box flexDirection="column" marginBottom={0}>
    <Text color="gray">{label}</Text>
    <Box paddingLeft={2} flexDirection="column" marginTop={0}>
      {lines.map((line, index) => (
        <Text key={`${label}-${index}`} wrap="truncate-end" color={valueColor} bold={bold}>
          {line}
        </Text>
      ))}
    </Box>
  </Box>
);

const RunListRow: React.FC<{
  run: EnrichedRun;
  selected: boolean;
  marker?: string;
  nowMs: number;
  layout: ReturnType<typeof computeListColumnLayout>;
  showMarker: boolean;
}> = ({ run, selected, marker, nowMs, layout, showMarker }) => {
  const status = formatRunStatus(run);
  const when = formatCompactWhen(run.createdAt, nowMs);
  const row = formatListRow(layout, showMarker, {
    marker,
    status,
    runId: shortRunId(run.id),
    testCase: run.testCaseName,
    agent: run.agentConfigName,
    model: run.agentModel,
    when,
    cost: `$${run.costUsd.toFixed(3)}`,
    steps: `${run.stepsCount} steps`,
  });

  return (
    <Box width={layout.width}>
      <Text inverse={selected} color={selected ? undefined : statusColor(status)}>
        {row.padEnd(layout.width, " ")}
      </Text>
    </Box>
  );
};

export const RunListApp: React.FC<RunListAppProps> = ({ runs, dbPath, loadTraces }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState({
    columns: stdout?.columns ?? 120,
    rows: stdout?.rows ?? 24,
  });

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
  const [detailPane, setDetailPane] = useState<DetailPane>("diff");
  const [detailWhenLabel, setDetailWhenLabel] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const sizeReady = useRef(false);

  const navigateToScreen = (next: Screen) => {
    if (next !== screen) {
      clearTerminalScreen(stdout);
    }
    setScreen(next);
  };

  useEffect(() => {
    if (screen !== "list") return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    const updateSize = () => {
      const next = {
        columns: stdout?.columns ?? 120,
        rows: stdout?.rows ?? 24,
      };
      if (sizeReady.current) {
        clearTerminalScreen(stdout);
        setLayoutEpoch((epoch) => epoch + 1);
      } else {
        sizeReady.current = true;
      }
      setTerminalSize(next);
    };
    updateSize();
    stdout?.on("resize", updateSize);
    return () => {
      stdout?.off("resize", updateSize);
    };
  }, [stdout]);

  const columns = terminalSize.columns;
  const listWindow = clamp(terminalSize.rows - 16, MIN_LIST_WINDOW, MAX_LIST_WINDOW);
  const showCompareMarker = comparePhase !== "idle";
  const listLayout = useMemo(
    () => computeListColumnLayout(columns, showCompareMarker),
    [columns, showCompareMarker],
  );

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
    setDetailPane("diff");
    setDetailWhenLabel(formatRunWhen(run.createdAt));
    navigateToScreen("detail");
  };

  const backToList = () => {
    setDetailTraces([]);
    setDetailRun(null);
    setComparePhase("idle");
    setCompareA(null);
    setCompareB(null);
    navigateToScreen("list");
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
    navigateToScreen("compare");
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
          setListScroll((scroll) => ensureCursorVisible(next, scroll, listWindow, runs.length));
          return next;
        });
        return;
      }
      if (key.downArrow || input === "j") {
        setCursor((c) => {
          const next = clamp(c + 1, 0, runs.length - 1);
          setListScroll((scroll) => ensureCursorVisible(next, scroll, listWindow, runs.length));
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
        setCursor(runs.findIndex((r) => r.id === detailRun.id));
        navigateToScreen("list");
        return;
      }
      if (key.tab || input === "t") {
        setDetailPane((pane) => (pane === "diff" ? "trace" : "diff"));
        return;
      }
      if (key.upArrow || input === "k") {
        if (detailPane === "diff") {
          setDetailDiffScroll((s) => clamp(s - 1, 0, maxDiffScroll(detailRun.finalDiff ?? "", DIFF_WINDOW)));
        } else {
          setDetailTraceScroll((s) => clamp(s - 1, 0, Math.max(0, detailTraces.length - DETAIL_TRACE_WINDOW)));
        }
        return;
      }
      if (key.downArrow || input === "j") {
        if (detailPane === "diff") {
          setDetailDiffScroll((s) => clamp(s + 1, 0, maxDiffScroll(detailRun.finalDiff ?? "", DIFF_WINDOW)));
        } else {
          setDetailTraceScroll((s) =>
            clamp(s + 1, 0, Math.max(0, detailTraces.length - DETAIL_TRACE_WINDOW)),
          );
        }
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

  const visibleRuns = runs.slice(listScroll, listScroll + listWindow);
  const compareMarker = (run: EnrichedRun): string | undefined => {
    if (comparePhase === "idle") return undefined;
    if (compareA?.id === run.id) return "A";
    if (comparePhase === "pick-b" && compareA && compareA.id !== run.id) return " ";
    return undefined;
  };

  return (
    <Box key={layoutEpoch} flexDirection="column" width={columns} padding={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        marginBottom={1}
        flexDirection="column"
        width={Math.max(columns - 2, 1)}
      >
        <Text color="cyan" bold>
          AGENTGRADER RUN HISTORY
        </Text>
        <Text color="gray" wrap="wrap">
          {dbPath}
        </Text>
      </Box>

      {runs.length === 0 ? (
        <Box flexDirection="column" width={Math.max(columns - 2, 1)}>
          <Text color="yellow">No runs found in the database.</Text>
          <Text color="gray">Run `agr run` or `agr bench` first, then reopen `agr list`.</Text>
          <Text color="gray">Press q to quit.</Text>
        </Box>
      ) : screen === "list" ? (
        <Box key="list" flexDirection="column" width={Math.max(columns - 2, 1)}>
          {comparePhase !== "idle" && (
            <Box marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1} width={listLayout.width}>
              <Text color="yellow" bold wrap="wrap">
                Diff compare:{" "}
                {comparePhase === "pick-a"
                  ? "pick run A (Enter), Esc to cancel"
                  : `A=${shortRunId(compareA!.id)} ${compareA!.agentConfigName} - pick run B (Enter)`}
              </Text>
            </Box>
          )}

          <Box marginBottom={1} width={listLayout.width}>
            <Text bold color="cyan">
              {formatListHeader(listLayout, showCompareMarker)}
            </Text>
          </Box>

          <Box flexDirection="column" marginBottom={1} width={listLayout.width}>
            {visibleRuns.map((run, index) => (
              <RunListRow
                key={run.id}
                run={run}
                selected={listScroll + index === cursor}
                marker={compareMarker(run)}
                nowMs={nowMs}
                layout={listLayout}
                showMarker={showCompareMarker}
              />
            ))}
          </Box>

          <Text color="gray">
            Showing {listScroll + 1}-{Math.min(listScroll + listWindow, runs.length)} of {runs.length} runs
          </Text>
          <Text color="gray">
            Enter open | c compare | ↑↓/jk move | q quit
          </Text>
        </Box>
      ) : screen === "detail" && detailRun ? (
        <Box key="detail" flexDirection="column" width={Math.max(columns - 2, 1)}>
          <Box
            flexDirection="column"
            borderStyle="double"
            borderColor={detailRun.passed ? "green" : "red"}
            paddingX={2}
            paddingY={0}
            width={listLayout.width}
          >
            <Text bold color="cyan">
              RUN DETAIL
            </Text>

            <DetailRow label="Run ID" lines={[detailRun.id]} />
            <DetailRow label="When" lines={[detailWhenLabel]} />
            <DetailRow label="Test case" lines={[detailRun.testCaseName, detailRun.testCaseId]} />
            <DetailRow label="Agent" lines={[detailRun.agentConfigName, detailRun.agentModel]} />
            <DetailRow
              label="Sandbox"
              lines={
                detailRun.matrixId
                  ? [detailRun.sandboxProvider, `matrix: ${detailRun.matrixId}`]
                  : [detailRun.sandboxProvider]
              }
            />
            <DetailRow
              label="Status"
              lines={[
                `${formatRunStatus(detailRun)}  |  $${detailRun.costUsd.toFixed(4)}  |  ${(detailRun.durationMs / 1000).toFixed(1)}s  |  ${detailRun.stepsCount} steps`,
              ]}
              valueColor={statusColor(formatRunStatus(detailRun))}
              bold
            />
            {detailRun.error && (
              <DetailRow label="Error" lines={[detailRun.error]} valueColor="red" />
            )}
          </Box>

          <DiffPanel
            diff={detailRun.finalDiff ?? ""}
            title={`Agent diff${detailPane === "diff" ? " (active)" : ""}`}
            scrollOffset={detailDiffScroll}
            maxVisibleLines={DIFF_WINDOW}
            width={listLayout.width}
          />

          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={detailPane === "trace" ? "cyan" : "gray"}
            paddingX={1}
            width={listLayout.width}
          >
            <Text bold color="cyan">
              Trace preview{detailPane === "trace" ? " (active)" : ""}
            </Text>
            {detailTraces.length === 0 ? (
              <>
                <Text color="gray">(no steps recorded)</Text>
                <Text color="gray"> </Text>
              </>
            ) : (
              Array.from({ length: DETAIL_TRACE_WINDOW }, (_, index) => {
                const step = detailTraces[detailTraceScroll + index];
                const line = step ? formatTraceLine(step, listLayout.width - 4) : " ";
                return (
                  <Box key={`trace-slot-${index}`} height={1}>
                    <Text wrap="truncate-end">{line.padEnd(listLayout.width - 4, " ")}</Text>
                  </Box>
                );
              })
            )}
            <Text color="gray">
              {traceFooterText(detailTraces.length, detailTraceScroll, DETAIL_TRACE_WINDOW)}
            </Text>
          </Box>

          <Box>
            <Text color="gray">
              Tab/t switch diff/trace | ↑↓ scroll active pane | c compare | b/Esc back | q quit
            </Text>
          </Box>
        </Box>
      ) : screen === "compare" && compareA && compareB ? (
        <Box key="compare" flexDirection="column" width={Math.max(columns - 2, 1)}>
          <Box
            borderStyle="double"
            borderColor="cyan"
            paddingX={2}
            paddingY={1}
            marginBottom={1}
            flexDirection="column"
            width={listLayout.width}
          >
            <Text bold color="cyan">
              AGENT DIFF COMPARE
            </Text>
            {compareA.testCaseId !== compareB.testCaseId && (
              <Text color="yellow" wrap="wrap">
                Warning: different test cases. Diff comparison may not be meaningful.
              </Text>
            )}
            <Text wrap="wrap">
              A: {shortRunId(compareA.id)}  |  {compareA.agentConfigName}  |  {formatRunStatus(compareA)}  |  {formatAbsoluteTime(compareA.createdAt)}
            </Text>
            <Text wrap="wrap">
              B: {shortRunId(compareB.id)}  |  {compareB.agentConfigName}  |  {formatRunStatus(compareB)}  |  {formatAbsoluteTime(compareB.createdAt)}
            </Text>
          </Box>

          {stackedDiff ? (
            <Box flexDirection="column" width={listLayout.width}>
              <DiffPanel
                diff={compareA.finalDiff ?? ""}
                title={`Run A (${shortRunId(compareA.id)})`}
                scrollOffset={compareScroll}
                maxVisibleLines={DIFF_WINDOW}
                width={listLayout.width}
              />
              <Box marginTop={1}>
                <DiffPanel
                  diff={compareB.finalDiff ?? ""}
                  title={`Run B (${shortRunId(compareB.id)})`}
                  scrollOffset={compareScroll}
                  maxVisibleLines={DIFF_WINDOW}
                  width={listLayout.width}
                />
              </Box>
            </Box>
          ) : (
            <Box flexDirection="row" width={listLayout.width}>
              <Box width={Math.floor(listLayout.width / 2) - 1} marginRight={1}>
                <DiffPanel
                  diff={compareA.finalDiff ?? ""}
                  title={`Run A (${shortRunId(compareA.id)})`}
                  scrollOffset={compareScroll}
                  maxVisibleLines={DIFF_WINDOW}
                  width={Math.floor(listLayout.width / 2) - 1}
                />
              </Box>
              <Box width={Math.floor(listLayout.width / 2) - 1}>
                <DiffPanel
                  diff={compareB.finalDiff ?? ""}
                  title={`Run B (${shortRunId(compareB.id)})`}
                  scrollOffset={compareScroll}
                  maxVisibleLines={DIFF_WINDOW}
                  width={Math.floor(listLayout.width / 2) - 1}
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
