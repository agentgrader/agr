import { getRun, getTraces, initDb } from "@agentgrader/store";

/**
 * `agr trace <runId> [--quality]`
 *
 * Prints the recorded step trace and metrics for a single run.
 *
 * With `--quality`, prints only the additive quality-scorer breakdown
 * (`metrics["static-quality"]`, `metrics["llm-judge"]`, plus the diff/
 * localization scorers) instead of the full step-by-step trace.
 */
export async function traceCommand(runId: string, opts: { quality?: boolean }) {
  const db = initDb();
  const run = await getRun(db, runId);
  if (!run) {
    console.error(`Run not found: ${runId}`);
    process.exit(1);
  }

  console.log(`Run ${run.id}`);
  console.log(`  test case:    ${run.testCaseId}`);
  console.log(`  agent config: ${run.agentConfigId}`);
  console.log(
    `  status:       ${run.status}${run.passed === true ? " (passed)" : run.passed === false ? " (failed)" : ""}`,
  );
  console.log(`  cost:         $${run.costUsd.toFixed(4)}`);
  console.log(`  duration:     ${run.durationMs}ms`);
  if (run.error) console.log(`  error:        ${run.error}`);

  if (opts.quality) {
    printQualityBreakdown(run.metrics);
    return;
  }

  const steps = await getTraces(db, runId);
  console.log(`\n${steps.length} step(s):`);
  for (const step of steps) {
    const label = step.tool ? `${step.kind}:${step.tool}` : step.kind;
    console.log(
      `  [${step.stepIndex}] ${label} (in:${step.tokensIn} out:${step.tokensOut} $${step.costUsd.toFixed(4)})`,
    );
    if (step.content) {
      const preview = step.content.length > 200 ? `${step.content.slice(0, 200)}...` : step.content;
      console.log(`      ${preview.replace(/\n/g, "\n      ")}`);
    }
  }
}

function printQualityBreakdown(metricsJson: string | null) {
  const metrics = metricsJson ? safeParseJson(metricsJson) : undefined;

  console.log("\n================ QUALITY BREAKDOWN ================");

  const staticQuality = metrics?.["static-quality"]?.quality;
  const llmJudge = metrics?.["llm-judge"]?.quality;
  const diff = metrics?.diff;
  const localization = metrics?.localization;

  if (staticQuality) {
    console.log("Static quality (static-quality):");
    if (staticQuality.diffLines !== undefined) console.log(`  diff lines:       ${staticQuality.diffLines}`);
    if (staticQuality.filesModified !== undefined)
      console.log(`  files modified:   ${staticQuality.filesModified}`);
    if (staticQuality.todosIntroduced !== undefined)
      console.log(`  TODOs introduced: ${staticQuality.todosIntroduced}`);
    if (staticQuality.linterViolations !== undefined)
      console.log(`  lint violations:  ${staticQuality.linterViolations}`);
  }

  if (llmJudge) {
    if (staticQuality) console.log("");
    console.log("LLM judge (llm-judge):");
    if (llmJudge.llmJudgeScore !== undefined)
      console.log(`  score:     ${llmJudge.llmJudgeScore.toFixed(2)} / 1.00`);
    if (llmJudge.llmJudgeDetail) console.log(`  rationale: ${llmJudge.llmJudgeDetail}`);
  }

  if (diff) {
    if (staticQuality || llmJudge) console.log("");
    console.log(`Diff scope: ${diff.detail ?? JSON.stringify(diff)}`);
  }

  if (localization) {
    console.log(`Localization: ${localization.detail ?? JSON.stringify(localization)}`);
  }

  if (!staticQuality && !llmJudge && !diff && !localization) {
    console.log("  (no quality metrics recorded for this run)");
  }

  console.log("=====================================================\n");
}

function safeParseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
