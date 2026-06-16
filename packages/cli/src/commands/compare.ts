import { getRun, getTraces, initDb, listRuns } from "@agentgrader/store";
import { formatDuration } from "../lib/format-relative-time";

type TraceRow = Awaited<ReturnType<typeof getTraces>>[number];

const CONTENT_PREVIEW_MAX = 200;

const ANSI = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};

function paint(text: string, code: string): string {
  if (!process.stdout.isTTY) return text;
  return `${code}${text}${ANSI.reset}`;
}

function truncateContent(content: string, full: boolean): string {
  if (full || content.length <= CONTENT_PREVIEW_MAX) return content;
  return `${content.slice(0, CONTENT_PREVIEW_MAX)}...`;
}

function normalizeContent(content: string | null | undefined): string {
  return (content ?? "").trim();
}

function formatStepSummary(step: TraceRow | undefined, full: boolean): string {
  if (!step) return "(no step)";
  const label = step.tool ? `${step.kind}:${step.tool}` : step.kind;
  if (!step.content) return label;
  const preview = truncateContent(step.content.replace(/\n/g, " "), full);
  return `${label} ${preview}`;
}

function stepsByIndex(traces: TraceRow[]): Map<number, TraceRow> {
  const map = new Map<number, TraceRow>();
  for (const step of traces) {
    map.set(step.stepIndex, step);
  }
  return map;
}

function stepsDiverge(a: TraceRow | undefined, b: TraceRow | undefined): boolean {
  if (!a || !b) return true;
  if (a.kind !== b.kind) return true;
  if ((a.tool ?? "") !== (b.tool ?? "")) return true;
  if (normalizeContent(a.content) !== normalizeContent(b.content)) return true;
  return false;
}

function formatRunStatus(run: NonNullable<Awaited<ReturnType<typeof getRun>>>): string {
  const passed =
    run.passed === true ? " (passed)" : run.passed === false ? " (failed)" : "";
  return `${run.status}${passed}`;
}

function printRunHeader(label: string, run: NonNullable<Awaited<ReturnType<typeof getRun>>>): void {
  const tag = label === "A" ? paint(`Run A (${run.id})`, ANSI.cyan) : paint(`Run B (${run.id})`, ANSI.blue);
  console.log(tag);
  console.log(`  test case:    ${run.testCaseId}`);
  console.log(`  agent config: ${run.agentConfigId}`);
  console.log(`  status:       ${formatRunStatus(run)}`);
  console.log(`  steps:        ${run.stepsCount}`);
  console.log(`  cost:         $${run.costUsd.toFixed(4)}`);
  console.log(`  duration:     ${formatDuration(run.durationMs)}`);
  if (run.tokensIn || run.tokensOut) {
    console.log(`  tokens:       ${run.tokensIn} in / ${run.tokensOut} out`);
  }
  if (run.error) console.log(`  error:        ${run.error}`);
}

/**
 * `agr compare <runIdA> <runIdB> [--full] [--only-diff]`
 * `agr compare --last-two [--full] [--only-diff]`
 *
 * Loads two completed runs from `.agr/db.sqlite` and prints their step traces
 * side by side, highlighting where the agents diverged.
 */
export async function compareCommand(
  runIdA: string | undefined,
  runIdB: string | undefined,
  opts: { full?: boolean; onlyDiff?: boolean; lastTwo?: boolean },
) {
  const db = initDb();

  if (opts.lastTwo) {
    const runs = await listRuns(db);
    if (runs.length < 2) {
      console.error(`Need at least 2 runs for --last-two (found ${runs.length}). Run \`agr run\` or \`agr bench\` first.`);
      process.exit(1);
    }
    runIdA = runs[1]!.id;
    runIdB = runs[0]!.id;
  }

  if (!runIdA || !runIdB) {
    console.error("Provide two run IDs or use --last-two to compare the two most recent runs.");
    process.exit(1);
  }

  const [runA, runB, tracesA, tracesB] = await Promise.all([
    getRun(db, runIdA),
    getRun(db, runIdB),
    getTraces(db, runIdA),
    getTraces(db, runIdB),
  ]);

  if (!runA) {
    console.error(`Run not found: ${runIdA}`);
    process.exit(1);
  }
  if (!runB) {
    console.error(`Run not found: ${runIdB}`);
    process.exit(1);
  }

  console.log("");
  printRunHeader("A", runA);
  console.log("");
  printRunHeader("B", runB);
  console.log("");

  if (runA.testCaseId !== runB.testCaseId) {
    console.log(
      paint(
        "[WARN] Comparing runs of different test cases - step alignment may not be meaningful.",
        ANSI.yellow,
      ),
    );
    console.log("");
  }

  const mapA = stepsByIndex(tracesA);
  const mapB = stepsByIndex(tracesB);
  const maxIndex = Math.max(
    tracesA.length > 0 ? Math.max(...tracesA.map((s) => s.stepIndex)) : -1,
    tracesB.length > 0 ? Math.max(...tracesB.map((s) => s.stepIndex)) : -1,
    -1,
  );

  if (maxIndex < 0) {
    console.log("No steps recorded for either run.");
    return;
  }

  const divergentIndices = new Set<number>();
  for (let i = 0; i <= maxIndex; i++) {
    if (stepsDiverge(mapA.get(i), mapB.get(i))) {
      divergentIndices.add(i);
    }
  }

  const visibleIndices = new Set<number>();
  if (opts.onlyDiff) {
    for (const idx of divergentIndices) {
      visibleIndices.add(idx);
      if (idx > 0) visibleIndices.add(idx - 1);
      if (idx < maxIndex) visibleIndices.add(idx + 1);
    }
  } else {
    for (let i = 0; i <= maxIndex; i++) visibleIndices.add(i);
  }

  const sortedVisible = [...visibleIndices].sort((a, b) => a - b);
  if (sortedVisible.length === 0) {
    console.log("No divergent steps (nothing to show with --only-diff).");
  } else {
    console.log("Step comparison:");
    for (const i of sortedVisible) {
      const stepA = mapA.get(i);
      const stepB = mapB.get(i);
      const divergent = stepsDiverge(stepA, stepB);

      if (divergent) {
        console.log(paint(`[step ${i}] DIVERGENT`, ANSI.yellow));
        console.log(`  A: ${formatStepSummary(stepA, opts.full ?? false)}`);
        console.log(`  B: ${formatStepSummary(stepB, opts.full ?? false)}`);
      } else {
        const line = formatStepSummary(stepA ?? stepB, opts.full ?? false);
        console.log(paint(`[step ${i}] (same)`, ANSI.gray));
        console.log(`  ${line}`);
      }
    }
  }

  const totalSteps = maxIndex + 1;
  const diffCount = divergentIndices.size;
  let firstDivergence: number | null = null;
  for (let i = 0; i <= maxIndex; i++) {
    if (divergentIndices.has(i)) {
      firstDivergence = i;
      break;
    }
  }

  console.log("");
  console.log(`${diffCount} of ${totalSteps} step(s) differ.`);
  if (firstDivergence !== null) {
    console.log(`First divergence at step ${firstDivergence}.`);
  } else {
    console.log("No divergence detected.");
  }
  console.log("");
  console.log(`Next: agr trace ${runIdA}  |  agr trace ${runIdB}`);
}
