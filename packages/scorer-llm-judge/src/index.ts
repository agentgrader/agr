import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { AgentResult, Scorer, ScorerResult, TestCase } from "@agentgrader/core";
import { generateObject } from "ai";
import { z } from "zod";

const JudgeResponseSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string(),
});

export interface LlmJudgeScorerOptions {
  /** which AI SDK provider to judge with. Defaults to "anthropic". */
  provider?: "anthropic" | "openai";
  /** model slug for the chosen provider. Defaults to a small, cheap model suitable for judging. */
  model?: string;
}

const DEFAULT_MODELS: Record<NonNullable<LlmJudgeScorerOptions["provider"]>, string> = {
  anthropic: "claude-3-5-haiku-20241022",
  openai: "gpt-4o-mini",
};

/**
 * Additive, non-blocking LLM-as-judge scorer: asks a model to rate the
 * agent's diff (0-1) for code quality and fit to the task, given the
 * original prompt. Never blocks a run (`passed` is always `true`) - it
 * only annotates `metrics["llm-judge"].quality.{llmJudgeScore,llmJudgeDetail}`.
 *
 * Degrades gracefully (no `quality` field) if the diff is empty or the
 * judge call fails (e.g. missing API key, network unavailable).
 */
export class LlmJudgeScorer implements Scorer {
  readonly name = "llm-judge";

  private readonly provider: NonNullable<LlmJudgeScorerOptions["provider"]>;
  private readonly modelName: string;

  constructor(options: LlmJudgeScorerOptions = {}) {
    this.provider = options.provider ?? "anthropic";
    this.modelName = options.model ?? DEFAULT_MODELS[this.provider];
  }

  async score(input: { testCase: TestCase; result: AgentResult }): Promise<ScorerResult> {
    const diff = input.result.finalDiff ?? "";
    if (!diff.trim()) {
      return { passed: true, detail: "llm-judge: no diff to judge" };
    }

    try {
      const { object } = await generateObject({
        model: this.resolveModel(),
        schema: JudgeResponseSchema,
        system:
          "You are a senior software engineer reviewing a coding agent's patch. " +
          "Rate the patch from 0 (poor: incorrect, sloppy, or unrelated changes) to 1 " +
          "(excellent: correct, minimal, idiomatic, and focused on the task). " +
          "Respond with a score and a one-sentence rationale.",
        prompt: `Task:\n${input.testCase.prompt}\n\nPatch:\n${diff}`,
      });

      return {
        passed: true,
        detail: `llm-judge: ${object.score.toFixed(2)} - ${object.rationale}`,
        quality: {
          llmJudgeScore: object.score,
          llmJudgeDetail: object.rationale,
        },
      };
    } catch (e: any) {
      return { passed: true, detail: `llm-judge unavailable: ${e.message}` };
    }
  }

  private resolveModel(): any {
    if (this.provider === "openai") {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || "mock-key" });
      return openai(this.modelName);
    }
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "mock-key" });
    return anthropic(this.modelName);
  }
}
