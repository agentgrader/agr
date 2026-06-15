import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { AgentResult, Rubric, Scorer, ScorerResult, TestCase } from "@agentgrader/core";
import { generateObject } from "ai";
import { z } from "zod";

const JudgeResponseSchema = z.object({
  score: z.number(),
  rationale: z.string(),
});

export interface LlmJudgeScorerOptions {
  provider?: "anthropic" | "openai";
  model?: string;
  gate?: boolean;
  minScore?: number;
}

const DEFAULT_MODELS: Record<NonNullable<LlmJudgeScorerOptions["provider"]>, string> = {
  anthropic: "claude-3-5-haiku-20241022",
  openai: "gpt-4o-mini",
};

function normalizeScore(score: number, scale: Rubric["scale"]): number {
  if (scale === "1-5") return Math.max(0, Math.min(1, (score - 1) / 4));
  return Math.max(0, Math.min(1, score));
}

export class LlmJudgeScorer implements Scorer {
  readonly name = "llm-judge";

  private readonly provider: NonNullable<LlmJudgeScorerOptions["provider"]>;
  private readonly modelName: string;
  private readonly gate: boolean;
  private readonly minScore: number;

  constructor(options: LlmJudgeScorerOptions = {}) {
    this.provider = options.provider ?? "anthropic";
    this.modelName = options.model ?? DEFAULT_MODELS[this.provider];
    this.gate = options.gate ?? false;
    this.minScore = options.minScore ?? 0.7;
  }

  async score(input: { testCase: TestCase; result: AgentResult }): Promise<ScorerResult> {
    const diff = input.result.finalDiff ?? "";
    if (!diff.trim()) {
      return { passed: !this.gate, detail: "llm-judge: no diff to judge" };
    }

    try {
      const defaultJudge = await this.judgeOnce(
        "You are a senior software engineer reviewing a coding agent's patch. Rate the patch from 0 (poor) to 1 (excellent). Respond with a score and a one-sentence rationale.",
        input.testCase.prompt,
        diff,
        0,
        1,
      );

      const rubricResults: Record<string, { score: number; normalizedScore: number; rationale: string }> = {};
      for (const rubric of input.testCase.rubrics ?? []) {
        const scaleMin = rubric.scale === "1-5" ? 1 : 0;
        const scaleMax = rubric.scale === "1-5" ? 5 : 1;
        const judged = await this.judgeOnce(
          `You are evaluating a coding patch. ${rubric.prompt} Respond with a numeric score between ${scaleMin} and ${scaleMax} and a one-sentence rationale.`,
          input.testCase.prompt,
          diff,
          scaleMin,
          scaleMax,
        );
        rubricResults[rubric.id] = {
          score: judged.score,
          normalizedScore: normalizeScore(judged.score, rubric.scale ?? "0-1"),
          rationale: judged.rationale,
        };
      }

      let aggregateScore = defaultJudge.score;
      const rubrics = input.testCase.rubrics ?? [];
      if (rubrics.length > 0) {
        const totalWeight = rubrics.reduce((sum, r) => sum + (r.weight ?? 1), 0);
        aggregateScore =
          rubrics.reduce(
            (sum, r) => sum + (rubricResults[r.id]?.normalizedScore ?? 0) * (r.weight ?? 1),
            0,
          ) / (totalWeight || 1);
      }

      const passed = this.gate ? aggregateScore >= this.minScore : true;
      return {
        passed,
        detail: `llm-judge: ${aggregateScore.toFixed(2)} - ${defaultJudge.rationale}`,
        score: aggregateScore,
        quality: {
          llmJudgeScore: aggregateScore,
          llmJudgeDetail: defaultJudge.rationale,
          rubrics: Object.keys(rubricResults).length > 0 ? rubricResults : undefined,
        },
      };
    } catch (e: any) {
      return { passed: !this.gate, detail: `llm-judge unavailable: ${e.message}` };
    }
  }

  private async judgeOnce(
    system: string,
    taskPrompt: string,
    diff: string,
    min: number,
    max: number,
  ): Promise<{ score: number; rationale: string }> {
    const { object } = await generateObject({
      model: this.resolveModel(),
      schema: JudgeResponseSchema,
      system,
      prompt: `Task:\n${taskPrompt}\n\nPatch:\n${diff}\n\nScore must be between ${min} and ${max}.`,
    });
    return {
      score: Math.max(min, Math.min(max, object.score)),
      rationale: object.rationale,
    };
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
