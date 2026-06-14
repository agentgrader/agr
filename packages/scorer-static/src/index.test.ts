import { describe, expect, test } from "bun:test";
import { StaticQualityScorer } from "./index";

const noExecSandbox = {
  exec: async (_cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    throw new Error("sandbox.exec should not be called");
  },
};

function sandboxReturning(stdout: string) {
  return {
    exec: async (_cmd: string) => ({ stdout, stderr: "", exitCode: 0 }),
  };
}

const SINGLE_FILE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 export function foo() {
-  return 1;
+  return 2;
+  // TODO: clean this up
 }
`;

describe("StaticQualityScorer", () => {
  const scorer = new StaticQualityScorer();

  test("always passes and reports zeroed quality for an empty diff", async () => {
    const result = await scorer.score({
      result: { finalDiff: "" } as any,
      sandbox: noExecSandbox,
    });

    expect(result.passed).toBe(true);
    expect(result.quality).toEqual({
      diffLines: 0,
      filesModified: 0,
      todosIntroduced: 0,
      linterViolations: 0,
    });
  });

  test("counts diff lines, files modified, and TODO markers introduced", async () => {
    const result = await scorer.score({
      result: { finalDiff: SINGLE_FILE_DIFF } as any,
      sandbox: sandboxReturning("{}"),
    });

    expect(result.quality.diffLines).toBe(3);
    expect(result.quality.filesModified).toBe(1);
    expect(result.quality.todosIntroduced).toBe(1);
    expect(result.detail).toContain("diff:3L files:1 todos:1");
  });

  test("does not count TODO/FIXME markers on removed lines", async () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
-// TODO: old marker
+// nothing to see here
`;
    const result = await scorer.score({
      result: { finalDiff: diff } as any,
      sandbox: sandboxReturning("{}"),
    });

    expect(result.quality.todosIntroduced).toBe(0);
  });

  test("sums errors and warnings from biome's summary field", async () => {
    const result = await scorer.score({
      result: { finalDiff: SINGLE_FILE_DIFF } as any,
      sandbox: sandboxReturning(JSON.stringify({ summary: { errors: 2, warnings: 3 } })),
    });

    expect(result.quality.linterViolations).toBe(5);
    expect(result.detail).toContain("lint:5");
  });

  test("falls back to counting a diagnostics array", async () => {
    const result = await scorer.score({
      result: { finalDiff: SINGLE_FILE_DIFF } as any,
      sandbox: sandboxReturning(JSON.stringify({ diagnostics: [{}, {}, {}] })),
    });

    expect(result.quality.linterViolations).toBe(3);
  });

  test("defaults to 0 violations when biome output is not JSON", async () => {
    const result = await scorer.score({
      result: { finalDiff: SINGLE_FILE_DIFF } as any,
      sandbox: sandboxReturning("npx: command not found\n"),
    });

    expect(result.quality.linterViolations).toBe(0);
  });

  test("defaults to 0 violations when sandbox.exec throws", async () => {
    const result = await scorer.score({
      result: { finalDiff: SINGLE_FILE_DIFF } as any,
      sandbox: {
        exec: async () => {
          throw new Error("no network in sandbox");
        },
      },
    });

    expect(result.passed).toBe(true);
    expect(result.quality.linterViolations).toBe(0);
  });
});
