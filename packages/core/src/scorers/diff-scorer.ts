import type { AgentResult } from "../adapters/agent-adapter";
import type { Scorer, ScorerResult } from "../adapters/scorer";
import type { TestCase } from "../schema/test-case";

export interface DiffStats {
  filesChanged: string[];
  insertions: number;
  deletions: number;
  linesChanged: number;
}

/** Parses a unified diff (as produced by `git diff`) into basic stats. */
export function parseDiffStats(diff: string): DiffStats {
  const filesChanged = new Set<string>();
  let insertions = 0;
  let deletions = 0;

  for (const line of diff.split("\n")) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      filesChanged.add(fileMatch[2]);
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) insertions++;
    else if (line.startsWith("-")) deletions++;
  }

  return {
    filesChanged: Array.from(filesChanged),
    insertions,
    deletions,
    linesChanged: insertions + deletions,
  };
}

/**
 * Scores the "scope" of an agent's patch.
 *
 * SWE-bench analyses showed agents frequently produce patches that are far
 * larger / touch far more files than the gold patch - editing unrelated
 * code, leaving debug statements, etc. This scorer reports diff stats and,
 * when a gold `solution` patch is available (loaded as raw diff content by
 * the CLI's `loadTestCase` helper), penalizes patches that are much larger
 * than the gold patch in terms of total changed lines.
 */
export class DiffScorer implements Scorer {
  readonly name = "DiffScorer";

  async score(input: { testCase: TestCase; result: AgentResult }): Promise<ScorerResult> {
    const stats = parseDiffStats(input.result.finalDiff ?? "");

    if (stats.filesChanged.length === 0) {
      return {
        passed: false,
        score: 0,
        detail: "Agent's diff is empty - no files were changed.",
      };
    }

    const details: string[] = [
      `Agent diff: ${stats.filesChanged.length} file(s), +${stats.insertions}/-${stats.deletions} lines.`,
    ];

    let score = 1;
    const solutionDiff = input.testCase.solution;
    if (solutionDiff?.includes("diff --git")) {
      const goldStats = parseDiffStats(solutionDiff);
      details.push(
        `Gold diff: ${goldStats.filesChanged.length} file(s), +${goldStats.insertions}/-${goldStats.deletions} lines.`,
      );

      const goldLines = Math.max(goldStats.linesChanged, 1);
      const ratio = stats.linesChanged / goldLines;
      // Patches at or below the gold patch's size score 1.0; larger patches
      // decay towards a floor of 0.1.
      score = ratio <= 1 ? 1 : Math.max(0.1, 1 / ratio);
      details.push(
        `Scope ratio (agent/gold lines changed): ${ratio.toFixed(2)} -> score ${score.toFixed(2)}`,
      );
    }

    return {
      passed: true,
      score,
      detail: details.join("\n"),
    };
  }
}
