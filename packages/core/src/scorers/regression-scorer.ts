import type { SandboxHandle } from "../adapters/sandbox-provider";
import type { Scorer, ScorerResult } from "../adapters/scorer";
import type { TestStatusMap } from "../adapters/test-result-parser";
import { TapTestResultParser } from "../adapters/test-result-parser";
import { matchAnyGlob } from "../runner/glob";
import type { TestCase } from "../schema/test-case";

/**
 * SWE-bench style regression scorer.
 *
 * - FAIL_TO_PASS: tests that were failing before the agent's patch and MUST
 *   pass afterwards. This is the actual "did the agent fix the bug" signal.
 * - PASS_TO_PASS: tests that were passing before the agent's patch and MUST
 *   keep passing afterwards (no regressions introduced).
 * - forbid_modified: acts as a tamper guard - if the agent edited test files
 *   (or other forbidden paths) to make the suite pass trivially, fail hard.
 *
 * If `test_command` / fail_to_pass / pass_to_pass are not configured on the
 * test case, this scorer is a no-op pass (keeps it backwards compatible).
 */
export class RegressionScorer implements Scorer {
  readonly name = "RegressionScorer";

  async score(input: {
    testCase: TestCase;
    sandbox: SandboxHandle;
    /** pre-patch test status map, used to avoid penalizing already-broken PASS_TO_PASS tests */
    baseline?: TestStatusMap;
  }): Promise<ScorerResult> {
    const { testCase, sandbox, baseline } = input;
    const failToPass = testCase.fail_to_pass ?? [];
    const passToPass = testCase.pass_to_pass ?? [];

    if (!testCase.test_command || (failToPass.length === 0 && passToPass.length === 0)) {
      return {
        passed: true,
        score: 1,
        detail: "No fail_to_pass/pass_to_pass criteria configured; skipping regression check.",
      };
    }

    // Tamper guard: forbidden files (e.g. the test files themselves) must not
    // appear in the agent's diff.
    if (testCase.forbid_modified?.length) {
      const diff = await sandbox.gitDiff();
      const changedFiles = parseChangedFiles(diff);
      const tampered = changedFiles.filter((f) => matchAnyGlob(testCase.forbid_modified!, f));
      if (tampered.length > 0) {
        return {
          passed: false,
          score: 0,
          detail: `Tamper guard triggered: forbidden files were modified: ${tampered.join(", ")}`,
        };
      }
    }

    let output = "";
    try {
      const res = await sandbox.exec(testCase.test_command);
      output = `${res.stdout}\n${res.stderr}`;
    } catch (err: any) {
      output = err?.message ?? String(err);
    }

    const statusMap = new TapTestResultParser().parse(output);
    const failures: string[] = [];

    for (const name of failToPass) {
      if (statusMap[name] !== "PASS") {
        failures.push(
          `FAIL_TO_PASS "${name}" did not pass (status: ${statusMap[name] ?? "not found"})`,
        );
      }
    }

    for (const name of passToPass) {
      if (statusMap[name] !== "PASS") {
        // if this test was already broken in the baseline, don't penalize the agent for it
        if (baseline?.[name] && baseline[name] !== "PASS") {
          continue;
        }
        failures.push(
          `PASS_TO_PASS "${name}" regressed (status: ${statusMap[name] ?? "not found"})`,
        );
      }
    }

    const total = failToPass.length + passToPass.length;
    const score = total > 0 ? (total - failures.length) / total : 1;

    if (failures.length > 0) {
      return {
        passed: false,
        score,
        detail: `Regression check failed (${total - failures.length}/${total} ok):\n${failures.join("\n")}`,
      };
    }

    return {
      passed: true,
      score: 1,
      detail: `All ${total} FAIL_TO_PASS/PASS_TO_PASS checks passed.`,
    };
  }
}

function parseChangedFiles(diff: string): string[] {
  const files = new Set<string>();
  const re = /^diff --git a\/(.+?) b\/(.+)$/gm;
  let match: RegExpExecArray | null = re.exec(diff);
  while (match) {
    files.add(match[1]);
    files.add(match[2]);
    match = re.exec(diff);
  }
  return Array.from(files);
}
