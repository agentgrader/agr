import type { Scorer } from "@agentgrader/core";
import { StaticQualityScorer } from "@agentgrader/scorer-static";
import { LlmJudgeScorer } from "@agentgrader/scorer-llm-judge";

export function buildExtraScorers(opts: {
  llmJudge?: boolean;
  llmJudgeProvider?: "anthropic" | "openai";
  llmJudgeModel?: string;
  judgeGate?: boolean;
  judgeMinScore?: number;
}): Scorer[] {
  const scorers: Scorer[] = [new StaticQualityScorer()];
  if (opts.llmJudge) {
    scorers.push(
      new LlmJudgeScorer({
        provider: opts.llmJudgeProvider,
        model: opts.llmJudgeModel,
        gate: opts.judgeGate,
        minScore: opts.judgeMinScore,
      }),
    );
  }
  return scorers;
}
