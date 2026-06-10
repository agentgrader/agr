import type { AgentResult } from "../adapters/agent-adapter";
import type { Scorer, ScorerResult } from "../adapters/scorer";
import { matchAnyGlob } from "../runner/glob";
import type { TestCase } from "../schema/test-case";
import { parseDiffStats } from "./diff-scorer";

/**
 * Measures whether the agent edited the "right" files, using
 * `expected_files` glob patterns (typically derived from the gold patch).
 *
 * - precision: fraction of files the agent touched that match an expected pattern
 * - recall: fraction of expected patterns that were matched by at least one touched file
 * - f1: harmonic mean of precision and recall
 */
export class LocalizationScorer implements Scorer {
  readonly name = "LocalizationScorer";

  async score(input: { testCase: TestCase; result: AgentResult }): Promise<ScorerResult> {
    const expectedFiles = input.testCase.expected_files;
    if (!expectedFiles || expectedFiles.length === 0) {
      return {
        passed: true,
        score: 1,
        detail: "No expected_files configured; skipping localization check.",
      };
    }

    const stats = parseDiffStats(input.result.finalDiff ?? "");
    const touched = stats.filesChanged;

    if (touched.length === 0) {
      return {
        passed: false,
        score: 0,
        detail: "Agent did not modify any files.",
      };
    }

    const truePositives = touched.filter((f) => matchAnyGlob(expectedFiles, f));
    const precision = truePositives.length / touched.length;

    const matchedPatterns = expectedFiles.filter((pattern) =>
      touched.some((f) => matchAnyGlob([pattern], f)),
    );
    const recall = matchedPatterns.length / expectedFiles.length;

    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    return {
      passed: f1 > 0,
      score: f1,
      detail: [
        `Localization: precision=${precision.toFixed(2)}, recall=${recall.toFixed(2)}, f1=${f1.toFixed(2)}`,
        `Touched files: ${touched.join(", ")}`,
        `Expected patterns: ${expectedFiles.join(", ")}`,
      ].join("\n"),
    };
  }
}
