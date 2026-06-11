import type { AgentResult, Scorer, ScorerResult } from "@agentgrader/core";
import { parseDiffStats } from "@agentgrader/core";

const TODO_PATTERN = /^\+.*\b(TODO|FIXME|HACK|XXX)\b/gm;

/**
 * deterministic, additive code-quality scorer: diff size, files touched,
 * todo/fixme markers introduced, and biome lint violations on the changed
 * files. never blocks a run (`passed` is always `true`) - it only annotates
 * `metrics["static-quality"]` with `quality` data for reporting/optimizer
 * use.
 *
 * no llm calls. lint runs via `npx @biomejs/biome` inside the sandbox; if
 * that's unavailable (no network, image without npm), `linterviolations`
 * degrades to `0` rather than failing the run.
 */
export class StaticQualityScorer implements Scorer {
  readonly name = "static-quality";

  async score(input: {
    result: AgentResult;
    sandbox: { exec(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> };
  }): Promise<ScorerResult> {
    const diff = input.result.finalDiff ?? "";
    const stats = parseDiffStats(diff);

    const diffLines = stats.linesChanged;
    const filesModified = stats.filesChanged.length;
    const todosIntroduced = (diff.match(TODO_PATTERN) ?? []).length;

    let linterViolations = 0;
    if (stats.filesChanged.length > 0) {
      try {
        const fileArgs = stats.filesChanged.map((f) => `"${f}"`).join(" ");
        const res = await input.sandbox.exec(
          `npx --yes @biomejs/biome@2 check ${fileArgs} --reporter=json 2>/dev/null || echo '{}'`,
        );
        linterViolations = parseBiomeViolationCount(res.stdout);
      } catch {
        // lint tooling unavailable in this sandbox image - leave at 0
      }
    }

    return {
      passed: true,
      detail: `diff:${diffLines}L files:${filesModified} todos:${todosIntroduced} lint:${linterViolations}`,
      quality: {
        diffLines,
        filesModified,
        todosIntroduced,
        linterViolations,
      },
    };
  }
}

/**
 * parses biome's `--reporter=json` output. defensive about shape since the
 * exact format has changed across biome versions; falls back to `0` for any
 * unrecognized or non-json output (e.g. when `npx` couldn't fetch biome).
 */
function parseBiomeViolationCount(output: string): number {
  try {
    const parsed = JSON.parse(output);
    const errors = parsed?.summary?.errors;
    const warnings = parsed?.summary?.warnings;
    if (typeof errors === "number" || typeof warnings === "number") {
      return (errors ?? 0) + (warnings ?? 0);
    }
    if (Array.isArray(parsed?.diagnostics)) {
      return parsed.diagnostics.length;
    }
  } catch {
    // not JSON , no lint data available
  }
  return 0;
}
