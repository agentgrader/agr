import type { AgentConfig } from "@agentgrader/core";

/**
 * Minimal shape of a persisted run row needed for aggregation. Matches both
 * `@agentgrader/store`'s `runs` rows (`metrics` as a JSON string) and
 * `RunSingleResult`-like objects (`metrics` as a parsed object).
 */
export interface RunRecord {
  agentConfigId: string;
  passed?: boolean | null;
  costUsd?: number | null;
  durationMs?: number | null;
  stepsCount?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  metrics?: string | Record<string, any> | null;
}

export interface QualityAverages {
  diffLines?: number;
  filesModified?: number;
  todosIntroduced?: number;
  linterViolations?: number;
  llmJudgeScore?: number;
}

export interface AggregateResult {
  agentConfigId: string;
  agentConfigName: string;
  totalRuns: number;
  passedRuns: number;
  solveRate: number;
  avgCostUsd: number;
  avgDurationMs: number;
  avgStepsCount: number;
  avgTokensIn: number;
  avgTokensOut: number;
  /** only set when every run for this config has `metrics["static-quality"].quality` */
  avgQuality?: QualityAverages;
}

const QUALITY_KEYS = [
  "diffLines",
  "filesModified",
  "todosIntroduced",
  "linterViolations",
  "llmJudgeScore",
] as const;

/**
 * Groups `runs` by `agentConfigId` and computes solve rate, average cost,
 * duration, token usage, and (if present on every run) average quality
 * metrics from `StaticQualityScorer`/`LlmJudgeScorer`.
 */
export function aggregateResults(runs: RunRecord[], configs: AgentConfig[]): AggregateResult[] {
  const configsById = new Map(configs.map((c) => [c.id || c.name, c]));

  const byConfig = new Map<string, RunRecord[]>();
  for (const run of runs) {
    const list = byConfig.get(run.agentConfigId);
    if (list) list.push(run);
    else byConfig.set(run.agentConfigId, [run]);
  }

  const results: AggregateResult[] = [];
  for (const [agentConfigId, configRuns] of byConfig) {
    const total = configRuns.length;
    const passed = configRuns.filter((r) => r.passed).length;
    const sum = (f: (r: RunRecord) => number) => configRuns.reduce((acc, r) => acc + f(r), 0);

    const qualities = configRuns
      .map((r) => extractQuality(r.metrics))
      .filter((q): q is QualityAverages => q !== undefined);

    let avgQuality: QualityAverages | undefined;
    if (total > 0 && qualities.length === total) {
      const avg: QualityAverages = {};
      for (const key of QUALITY_KEYS) {
        const values = qualities.map((q) => q[key]).filter((v): v is number => typeof v === "number");
        if (values.length === qualities.length) {
          avg[key] = values.reduce((a, b) => a + b, 0) / values.length;
        }
      }
      if (Object.keys(avg).length > 0) avgQuality = avg;
    }

    results.push({
      agentConfigId,
      agentConfigName: configsById.get(agentConfigId)?.name ?? agentConfigId,
      totalRuns: total,
      passedRuns: passed,
      solveRate: total > 0 ? passed / total : 0,
      avgCostUsd: total > 0 ? sum((r) => r.costUsd ?? 0) / total : 0,
      avgDurationMs: total > 0 ? sum((r) => r.durationMs ?? 0) / total : 0,
      avgStepsCount: total > 0 ? sum((r) => r.stepsCount ?? 0) / total : 0,
      avgTokensIn: total > 0 ? sum((r) => r.tokensIn ?? 0) / total : 0,
      avgTokensOut: total > 0 ? sum((r) => r.tokensOut ?? 0) / total : 0,
      avgQuality,
    });
  }

  return results;
}

function extractQuality(metrics: RunRecord["metrics"]): QualityAverages | undefined {
  if (!metrics) return undefined;
  const parsed = typeof metrics === "string" ? safeParseJson(metrics) : metrics;
  const staticQuality = parsed?.["static-quality"]?.quality;
  const llmQuality = parsed?.["llm-judge"]?.quality;
  if (!staticQuality && !llmQuality) return undefined;
  return {
    ...staticQuality,
    llmJudgeScore: llmQuality?.llmJudgeScore ?? staticQuality?.llmJudgeScore,
  };
}

function safeParseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
