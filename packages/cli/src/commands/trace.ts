import { getRun, getTraces, initDb, listRuns, agentConfigs } from "@agentgrader/store";
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
function parseStepsRange(range: string | undefined): { from: number; to: number } | undefined {
  if (!range) return undefined;
  const m = range.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return undefined;
  const from = parseInt(m[1]!, 10);
  const to = m[2] !== undefined ? parseInt(m[2]!, 10) : from;
  return { from, to };
}

export async function traceCommand(runId: string | undefined, opts: { quality?: boolean; tools?: boolean; kindSummary?: boolean; last?: boolean; testCase?: string; config?: string; model?: string; passed?: boolean; json?: boolean; steps?: string; grep?: string; full?: boolean; topCost?: number; kind?: string; stepCount?: boolean; minCost?: number; maxCost?: number }) {
  const db = initDb();

  let resolvedRunId = runId;
  if (opts.last) {
    const runs = await listRuns(db);
    let filtered = opts.testCase
      ? runs.filter((r) => r.testCaseId === opts.testCase || r.testCaseId.includes(opts.testCase!))
      : runs;
    if (opts.config) {
      filtered = filtered.filter((r) => r.agentConfigId === opts.config || r.agentConfigId.includes(opts.config!));
    }
    if (opts.model) {
      const cfgRows = await db.select().from(agentConfigs);
      const modelByConfigId = new Map(cfgRows.map((r) => [r.id, r.model ?? ""]));
      const mf = opts.model.toLowerCase();
      filtered = filtered.filter((r) => (modelByConfigId.get(r.agentConfigId) ?? "").toLowerCase().includes(mf));
    }
    if (opts.passed !== undefined) {
      filtered = filtered.filter((r) => r.passed === opts.passed);
    }
    if (filtered.length === 0) {
      const parts: string[] = [];
      if (opts.testCase) parts.push(`test case "${opts.testCase}"`);
      if (opts.config) parts.push(`config "${opts.config}"`);
      if (opts.model) parts.push(`model "${opts.model}"`);
      if (opts.passed === true) parts.push("passed runs");
      if (opts.passed === false) parts.push("failed runs");
      const scope = parts.length ? ` for ${parts.join(" and ")}` : "";
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

  const runSummary = {
    id: run.id,
    testCaseId: run.testCaseId,
    agentConfigId: run.agentConfigId,
    status: run.status,
    passed: run.passed ?? null,
    stepsCount: run.stepsCount,
    costUsd: run.costUsd,
    durationMs: run.durationMs,
    tokensIn: run.tokensIn ?? 0,
    tokensOut: run.tokensOut ?? 0,
    error: run.error ?? null,
    metrics: run.metrics ? safeParseJson(run.metrics) : null,
  };

  if (!opts.json) {
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

    const agentError = runSummary.metrics?.agentError;
    if (agentError && agentError !== run.error) {
      console.log(`  agent error:  ${agentError}`);
    }
  }

  const tcSuffix = opts.testCase ? ` --test-case ${opts.testCase}` : "";
  const cfgSuffix = opts.config ? ` --config ${opts.config}` : "";
  const compareSuffix = `${tcSuffix}${cfgSuffix}`;

  if (opts.quality) {
    if (opts.json) {
      console.log(JSON.stringify({ run: runSummary, metrics: runSummary.metrics ?? null }));
      return;
    }
    printQualityBreakdown(run.metrics);
    console.log(`\nNext: agr trace ${resolvedRunId} --tools  |  agr compare --last-two${compareSuffix}`);
    return;
  }

  const allSteps = await getTraces(db, resolvedRunId);
  const stepsRange = parseStepsRange(opts.steps);
  const rangeFiltered = stepsRange
    ? allSteps.filter((s) => s.stepIndex >= stepsRange.from && s.stepIndex <= stepsRange.to)
    : allSteps;
  const grepPattern = opts.grep?.toLowerCase();
  const grepFiltered = grepPattern
    ? rangeFiltered.filter((s) => {
        const label = s.tool ? `${s.kind}:${s.tool}` : s.kind;
        return label.toLowerCase().includes(grepPattern) || (s.content ?? "").toLowerCase().includes(grepPattern);
      })
    : rangeFiltered;
  const kindFiltered = opts.kind
    ? grepFiltered.filter((s) => s.kind === opts.kind || (s.tool && `${s.kind}:${s.tool}` === opts.kind))
    : grepFiltered;
  const costFiltered = kindFiltered.filter((s) => {
    if (opts.minCost !== undefined && s.costUsd < opts.minCost) return false;
    if (opts.maxCost !== undefined && s.costUsd > opts.maxCost) return false;
    return true;
  });
  const steps = opts.topCost
    ? [...costFiltered].sort((a, b) => b.costUsd - a.costUsd).slice(0, opts.topCost)
    : costFiltered;

  if (opts.stepCount) {
    if (opts.json) {
      console.log(JSON.stringify({ stepCount: allSteps.length, filteredCount: steps.length, runId: resolvedRunId }));
    } else {
      console.log(String(allSteps.length));
    }
    return;
  }

  if (opts.kindSummary) {
    const kindCounts = new Map<string, number>();
    for (const s of allSteps) {
      const label = s.tool ? `${s.kind}:${s.tool}` : s.kind;
      kindCounts.set(label, (kindCounts.get(label) ?? 0) + 1);
    }
    const sorted = [...kindCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (opts.json) {
      const kinds = sorted.map(([kind, count]) => ({ kind, count }));
      console.log(JSON.stringify({ run: runSummary, total: allSteps.length, kinds }));
      return;
    }
    console.log(`\nStep kinds (${allSteps.length} total):\n`);
    const maxCount = Math.max(...sorted.map(([, c]) => c));
    const barWidth = 20;
    for (const [kind, count] of sorted) {
      const bar = "█".repeat(Math.round((count / maxCount) * barWidth));
      console.log(`  ${kind.padEnd(24)} ${String(count).padStart(4)}  ${bar}`);
    }
    console.log(`\nNext: agr trace ${resolvedRunId} --tools  |  agr trace ${resolvedRunId} --kind <kind>`);
    return;
  }

  if (opts.tools) {
    const toolCounts = countToolCalls(steps);
    if (opts.json) {
      console.log(JSON.stringify({ run: runSummary, toolUsage: toolCounts }));
      return;
    }
    printToolUsageBlock(toolCounts, { header: "\n================ TOOL USAGE ================" });
    console.log("=============================================\n");
    console.log(`Next: agr trace ${resolvedRunId} --quality  |  agr compare --last-two${compareSuffix}`);
    return;
  }

  if (opts.json) {
    const stepsOut = steps.map((s) => ({
      stepIndex: s.stepIndex,
      kind: s.kind,
      tool: s.tool ?? null,
      content: s.content ?? null,
      tokensIn: s.tokensIn,
      tokensOut: s.tokensOut,
      cachedTokens: s.cachedTokens ?? 0,
      costUsd: s.costUsd,
    }));
    const out: Record<string, unknown> = { run: runSummary, steps: stepsOut };
    if (stepsRange) out.stepsRange = stepsRange;
    if (grepPattern) out.grep = opts.grep;
    console.log(JSON.stringify(out));
    return;
  }

  let stepsLabel = stepsRange
    ? `${steps.length} step(s) [${stepsRange.from}-${stepsRange.to}] of ${allSteps.length} total`
    : `${steps.length} step(s)`;
  if (grepPattern) {
    const pool = stepsRange ? rangeFiltered.length : allSteps.length;
    stepsLabel = `${steps.length} matching step(s) for "${opts.grep}" of ${pool} total`;
  }
  if (opts.kind) {
    stepsLabel = `${kindFiltered.length} step(s) of kind "${opts.kind}" of ${grepFiltered.length} total`;
  }
  if (opts.minCost !== undefined || opts.maxCost !== undefined) {
    const rangeNote = opts.minCost !== undefined && opts.maxCost !== undefined
      ? `$${opts.minCost}-$${opts.maxCost}`
      : opts.minCost !== undefined ? `>= $${opts.minCost}` : `<= $${opts.maxCost}`;
    stepsLabel = `${costFiltered.length} step(s) costing ${rangeNote} of ${kindFiltered.length} total`;
  }
  if (opts.topCost) {
    stepsLabel = `top ${steps.length} most expensive step(s) of ${costFiltered.length} total (sorted by cost desc)`;
  }
  console.log(`\n${stepsLabel}:`);
  let totalCachedTokens = 0;
  let totalTokensIn = 0;
  for (const step of steps) {
    const label = step.tool ? `${step.kind}:${step.tool}` : step.kind;
    const cached = step.cachedTokens ? ` cached:${step.cachedTokens}` : "";
    console.log(
      `  [${step.stepIndex}] ${label} (in:${step.tokensIn} out:${step.tokensOut}${cached} $${step.costUsd.toFixed(4)})`,
    );
    if (step.content) {
      const preview = !opts.full && step.content.length > 200 ? `${step.content.slice(0, 200)}...` : step.content;
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
  console.log(`\nNext: agr trace ${resolvedRunId} --quality  |  agr trace ${resolvedRunId} --tools  |  agr compare --last-two${compareSuffix}`);
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
