import { describe, expect, test } from "bun:test";
import { DiffScorer, parseDiffStats } from "./diff-scorer";

const SAMPLE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 export function foo() {
-  return 1;
+  return 2;
+  // extra line
 }
diff --git a/src/bar.ts b/src/bar.ts
index 3333333..4444444 100644
--- a/src/bar.ts
+++ b/src/bar.ts
@@ -1,2 +1,2 @@
-export const bar = 1;
+export const bar = 2;
`;

describe("parseDiffStats", () => {
  test("returns zeroed stats for an empty diff", () => {
    expect(parseDiffStats("")).toEqual({
      filesChanged: [],
      insertions: 0,
      deletions: 0,
      linesChanged: 0,
    });
  });

  test("counts files, insertions, and deletions across multiple files", () => {
    const stats = parseDiffStats(SAMPLE_DIFF);
    expect(stats.filesChanged).toEqual(["src/foo.ts", "src/bar.ts"]);
    expect(stats.insertions).toBe(3);
    expect(stats.deletions).toBe(2);
    expect(stats.linesChanged).toBe(5);
  });

  test("ignores the +++ / --- file header lines", () => {
    const diff = `diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n+added line\n`;
    const stats = parseDiffStats(diff);
    expect(stats.insertions).toBe(1);
    expect(stats.deletions).toBe(0);
  });
});

describe("DiffScorer", () => {
  const scorer = new DiffScorer();

  test("fails with score 0 when the diff is empty", async () => {
    const result = await scorer.score({
      testCase: {} as any,
      result: { finalDiff: "" } as any,
    });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.detail).toContain("no files were changed");
  });

  test("scores 1.0 when there is no gold solution diff to compare against", async () => {
    const result = await scorer.score({
      testCase: {} as any,
      result: { finalDiff: SAMPLE_DIFF } as any,
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.detail).toContain("Agent diff: 2 file(s), +3/-2 lines.");
  });

  test("scores 1.0 when the agent's diff is at or below the gold diff's size", async () => {
    const result = await scorer.score({
      testCase: { solution: SAMPLE_DIFF } as any,
      result: { finalDiff: SAMPLE_DIFF } as any,
    });
    expect(result.score).toBe(1);
    expect(result.detail).toContain("Scope ratio (agent/gold lines changed): 1.00 -> score 1.00");
  });

  test("penalizes a diff that is larger than the gold diff, with a floor of 0.1", async () => {
    const goldDiff = `diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n+one line\n`;
    const result = await scorer.score({
      testCase: { solution: goldDiff } as any,
      result: { finalDiff: SAMPLE_DIFF } as any,
    });
    // gold has 1 changed line, agent diff has 5 -> ratio 5 -> score 0.2
    expect(result.score).toBeCloseTo(0.2, 5);
  });
});
