import { getRun, getTraces, initDb, listRuns } from "@agentgrader/store";
import { countToolCalls, printToolUsageBlock } from "../lib/tool-usage";
import { formatDuration } from "../lib/format-relative-time";

/**
 * `agr trace <runId> [--quality] [--tools]`
 *
 * Prints the recorded step trace and metrics for a single run.
 *
 * With `--quality`, prints only the additive quality-scorer breakdown
 * (`metrics["static-quality"]`, `metrics["llm-judge"]`, plus the diff/
 * localization scorers) instead of the full step-by-step trace.
 *
 * With `--tools`, prints only a tool-usage breakdown: how many times each
 * tool name appears across the run's `tool_call` steps. Useful for checking
 * whether a custom toolkit/MCP tool was actually used, vs. only available.
 */
export async function traceCommand(runId: string | undefined, opts: { quality?: boolean; tools?: boolean; last?: boolean; testCase?: string }) {
  const db = initDb();

  let resolvedRunId = runId;
  if (opts.last) {
    const runs = await listRuns(db);
    const filtered = opts.testCase
      ? runs.filter((r) => r.testCaseId === opts.testCase || r.testCaseId.includes(opts.testCase!))
      : runs;
    if (filtered.length === 0) {
      const scope = opts.testCase ? ` for test case "${opts.testCase}"` : "";
      console.error(`No runs found${scope} in .agr/db.sqlite. Run \`agr run\` or \`agr bench\` first.`);
      process.exit(1);
    }
    resolvedRunId = filtered[0]!.id;
  }

  if (!resolvedRunId) {
    console.error("Provide a run ID or use --last to trace the most recent run.");
    process.exit(1);
  }

  const run = await getRun(db, resolvedRunId);
  if (!run) {
    console.error(`Run not found: ${resolvedRunId}`);
    process.exit(1);
  }

  console.log(`Run ${run.id}`);
  console.log(`  test case:    ${run.testCaseId}`);
  console.log(`  agent config: ${run.agentConfigId}`);
  console.log(
    `  status:       ${run.status}${run.passed === true ? " (passed)" : run.passed === false ? " (failed)" : ""}`,
  );
  console.log(`  steps:        ${run.stepsCount}`);
  console.log(`  cost:         $${run.costUsd.toFixed(4)}`);
  console.log(`  duration:     ${formatDuration(run.durationMs)}`);
  if (run.tokensIn || run.tokensOut) {
    console.log(`  tokens:       ${run.tokensIn} in / ${run.tokensOut} out`);
  }
  if (run.error) console.log(`  error:        ${run.error}`);

  const agentError = run.metrics ? safeParseJson(run.metrics)?.agentError : undefined;
  if (agentError && agentError !== run.error) {
    console.log(`  agent error:  ${agentError}`);
  }

  if (opts.quality) {
    printQualityBreakdown(run.metrics);
    console.log(`\nNext: agr trace ${resolvedRunId} --tools  |  agr compare --last-two`);
    return;
  }

  const steps = await getTraces(db, resolvedRunId);

  if (opts.tools) {
    printToolUsageBlock(countToolCalls(steps), { header: "\n================ TOOL USAGE ================" });
    console.log("=============================================\n");
    console.log(`Next: agr trace ${resolvedRunId} --quality  |  agr compare --last-two`);
    return;
  }

  console.log(`\n${steps.length} step(s):`);
  let totalCachedTokens = 0;
  let totalTokensIn = 0;
  for (const step of steps) {
    const label = step.tool ? `${step.kind}:${step.tool}` : step.kind;
    const cached = step.cachedTokens ? ` cached:${step.cachedTokens}` : "";
    console.log(
      `  [${step.stepIndex}] ${label} (in:${step.tokensIn} out:${step.tokensOut}${cached} $${step.costUsd.toFixed(4)})`,
    );
    if (step.content) {
      const preview = step.content.length > 200 ? `${step.content.slice(0, 200)}...` : step.content;
      console.log(`      ${preview.replace(/\n/g, "\n      ")}`);
    }
    totalCachedTokens += step.cachedTokens || 0;
    totalTokensIn += step.tokensIn || 0;
  }

  if (totalTokensIn > 0) {
    const cacheHitRate = ((totalCachedTokens / totalTokensIn) * 100).toFixed(1);
    console.log(
      `\nprompt cache: ${totalCachedTokens}/${totalTokensIn} input tokens served from cache (${cacheHitRate}%)`,
    );
  }
  console.log(`\nNext: agr trace ${resolvedRunId} --quality  |  agr trace ${resolvedRunId} --tools  |  agr compare --last-two`);
}

/**
 * Renders a `CommandUsageSource` (see `@agentgrader/core`'s `tool-usage.ts`)
 * for `agr trace --quality`'s tool-adoption/tool-usage breakdown, so the
 * *mechanism* of adoption is visible alongside pass/fail - e.g. distinguishing
 * a tool the agent called directly from one only credited via another tool's
 * folded-in output (like `inspect-code` findings folded into `show-diff`).
 *
 * `usedFallback` covers runs recorded before `usedVia` was tracked: if the
 * tool was used but its mechanism wasn't recorded, say so rather than
 * misreporting it as MISSING.
 */
export function describeUsage(source: "direct" | "wrapped" | undefined, usedFallback: boolean): string {
  if (source === "direct") return "OK (called directly)";
  if (source === "wrapped") return "OK (via another tool's output)";
  if (usedFallback) return "OK (mechanism not recorded for this run)";
  return "MISSING";
}

export function printQualityBreakdown(metricsJson: string | null) {
  const metrics = metricsJson ? safeParseJson(metricsJson) : undefined;

  console.log("\n================ QUALITY BREAKDOWN ================");

  const staticQuality = metrics?.["static-quality"]?.quality;
  const llmJudge = metrics?.["llm-judge"]?.quality;
  const diff = metrics?.diff;
  const localization = metrics?.localization;
  const toolAdoption = metrics?.["tool-adoption"];
  const toolUsage = metrics?.["tool-usage"];

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

  if (toolAdoption) {
    if (staticQuality || llmJudge || diff || localization) console.log("");
    const mark = toolAdoption.passed ? "OK" : "MISSING";
    console.log(`Tool adoption (require_tools_before_submit): ${mark}`);
    console.log(`  ${toolAdoption.detail}`);
    for (const name of toolAdoption.required ?? []) {
      const usedFallback = !(toolAdoption.missing ?? []).includes(name);
      console.log(`    ${name}: ${describeUsage(toolAdoption.usedVia?.[name], usedFallback)}`);
    }
  }

  if (toolUsage) {
    if (staticQuality || llmJudge || diff || localization || toolAdoption) console.log("");
    console.log(`Tool usage (track_tools): ${toolUsage.detail}`);
    for (const name of toolUsage.used ?? []) {
      console.log(`    ${name}: ${describeUsage(toolUsage.usedVia?.[name], true)}`);
    }
    if (toolUsage.unused?.length > 0) {
      console.log(`  Not used: ${toolUsage.unused.join(", ")}`);
    }
  }

  if (!staticQuality && !llmJudge && !diff && !localization && !toolAdoption && !toolUsage) {
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
