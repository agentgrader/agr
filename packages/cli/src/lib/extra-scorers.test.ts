import { describe, expect, test } from "bun:test";
import { buildExtraScorers } from "./extra-scorers";

describe("buildExtraScorers", () => {
  test("always includes StaticQualityScorer", () => {
    const scorers = buildExtraScorers({});
    expect(scorers.map((s) => s.name)).toEqual(["static-quality"]);
  });

  test("appends LlmJudgeScorer when llmJudge is enabled", () => {
    const scorers = buildExtraScorers({
      llmJudge: true,
      llmJudgeProvider: "openai",
      judgeGate: true,
      judgeMinScore: 0.8,
    });
    expect(scorers.map((s) => s.name)).toEqual(["static-quality", "llm-judge"]);
  });
});
