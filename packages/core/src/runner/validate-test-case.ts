import type { SandboxProvider } from "../adapters/sandbox-provider";
import {
  TapTestResultParser,
  type TestStatus,
  type TestStatusMap,
} from "../adapters/test-result-parser";
import type { TestCase } from "../schema/test-case";
import { matchGlob } from "./glob";

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ValidationReport {
  ok: boolean;
  checks: ValidationCheck[];
}

/**
 * validates a test case the way SWE-bench validates a candidate task
 * instance before it's added to the benchmark:
 *
 * 1. static check required fields are present and internally consistent.
 * 2. pre-patch run - FAIL_TO_PASS tests must currently be FAILING and
 *    PASS_TO_PASS tests must currently be PASSING (on the raw fixture, with
 *    `test_patch` applied if present).
 * 3. post-patch run - if a gold `solution` patch is provided, apply it and
 *    verify FAIL_TO_PASS tests now PASS and PASS_TO_PASS tests still PASS.
 *
 * this catches the most common authoring mistakes: typo'd test names,
 * tests that pass/fail for the wrong reason, gold patches that don't
 * actually fix the issue, and forbidden-file globs that never match.
 */
export async function validateTestCase(input: {
  testCase: TestCase;
  sandboxProvider: SandboxProvider;
}): Promise<ValidationReport> {
  const { testCase, sandboxProvider } = input;
  const checks: ValidationCheck[] = [];

  checks.push(...checkStaticFields(testCase));

  if (!testCase.test_command) {
    checks.push({
      name: "execution-checks",
      passed: true,
      detail: "No test_command configured; skipping pre/post-patch execution checks.",
    });
    return finalize(checks);
  }

  const sandbox = await sandboxProvider.create({ gitSnapshot: testCase.fixture });
  try {
    // apply the (evaluation-only) test patch first, since fail_to_pass tests
    // may only exist after it's applied.
    if (testCase.test_patch) {
      const patchRes = await sandbox.applyPatch(testCase.test_patch);
      checks.push({
        name: "test_patch applies cleanly",
        passed: patchRes.applied,
        detail: patchRes.applied
          ? `Applied${patchRes.repaired ? " (required repair/fallback)" : ""}.`
          : `Failed to apply test_patch:\n${patchRes.output}`,
      });
      if (!patchRes.applied) return finalize(checks);
    }

    const preRun = await sandbox.exec(testCase.test_command);
    const preStatus = new TapTestResultParser().parse(`${preRun.stdout}\n${preRun.stderr}`);

    checks.push(
      checkStatusExpectation(
        "pre-patch: fail_to_pass tests are currently failing",
        testCase.fail_to_pass ?? [],
        preStatus,
        "FAIL",
      ),
    );
    checks.push(
      checkStatusExpectation(
        "pre-patch: pass_to_pass tests are currently passing",
        testCase.pass_to_pass ?? [],
        preStatus,
        "PASS",
      ),
    );

    if (testCase.solution) {
      const solutionRes = await sandbox.applyPatch(testCase.solution);
      checks.push({
        name: "solution patch applies cleanly",
        passed: solutionRes.applied,
        detail: solutionRes.applied
          ? `Applied${solutionRes.repaired ? " (required repair/fallback)" : ""}.`
          : `Failed to apply solution patch:\n${solutionRes.output}`,
      });

      if (solutionRes.applied) {
        const postRun = await sandbox.exec(testCase.test_command);
        const postStatus = new TapTestResultParser().parse(`${postRun.stdout}\n${postRun.stderr}`);

        checks.push(
          checkStatusExpectation(
            "post-patch: fail_to_pass tests now pass",
            testCase.fail_to_pass ?? [],
            postStatus,
            "PASS",
          ),
        );
        checks.push(
          checkStatusExpectation(
            "post-patch: pass_to_pass tests still pass",
            testCase.pass_to_pass ?? [],
            postStatus,
            "PASS",
          ),
        );
      }
    }
  } finally {
    await sandbox.destroy();
  }

  return finalize(checks);
}

function checkStaticFields(testCase: TestCase): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  checks.push({
    name: "has name and prompt",
    passed: Boolean(testCase.name && testCase.prompt),
    detail:
      testCase.name && testCase.prompt ? "ok" : "Test case is missing `name` and/or `prompt`.",
  });

  const failToPass = testCase.fail_to_pass ?? [];
  const passToPass = testCase.pass_to_pass ?? [];

  if (failToPass.length > 0 || passToPass.length > 0) {
    checks.push({
      name: "test_command configured for fail_to_pass/pass_to_pass",
      passed: Boolean(testCase.test_command),
      detail: testCase.test_command
        ? "ok"
        : "fail_to_pass/pass_to_pass are set but no test_command was provided.",
    });

    const overlap = failToPass.filter((n) => passToPass.includes(n));
    checks.push({
      name: "fail_to_pass and pass_to_pass do not overlap",
      passed: overlap.length === 0,
      detail: overlap.length === 0 ? "ok" : `Tests listed in both sets: ${overlap.join(", ")}`,
    });
  }

  if (testCase.forbid_modified?.length) {
    const invalid = testCase.forbid_modified.filter((p) => !isLikelyValidGlob(p));
    checks.push({
      name: "forbid_modified patterns look valid",
      passed: invalid.length === 0,
      detail: invalid.length === 0 ? "ok" : `Suspicious glob pattern(s): ${invalid.join(", ")}`,
    });
  }

  if (testCase.expected_files?.length) {
    const invalid = testCase.expected_files.filter((p) => !isLikelyValidGlob(p));
    checks.push({
      name: "expected_files patterns look valid",
      passed: invalid.length === 0,
      detail: invalid.length === 0 ? "ok" : `Suspicious glob pattern(s): ${invalid.join(", ")}`,
    });
  }

  if (testCase.created_at) {
    const date = new Date(testCase.created_at);
    checks.push({
      name: "created_at is a parseable date (contamination/date-cutoff check)",
      passed: !Number.isNaN(date.getTime()),
      detail: !Number.isNaN(date.getTime())
        ? `ok (${date.toISOString()})`
        : `Could not parse created_at: "${testCase.created_at}"`,
    });
  }

  return checks;
}

function isLikelyValidGlob(pattern: string): boolean {
  if (!pattern || pattern.trim().length === 0) return false;
  try {
    matchGlob(pattern, "x");
    return true;
  } catch {
    return false;
  }
}

function checkStatusExpectation(
  name: string,
  testNames: string[],
  statusMap: TestStatusMap,
  expected: TestStatus,
): ValidationCheck {
  if (testNames.length === 0) {
    return { name, passed: true, detail: "No tests configured for this check." };
  }

  const problems: string[] = [];
  for (const testName of testNames) {
    const actual = statusMap[testName];
    if (actual === undefined) {
      problems.push(`"${testName}" not found in test output`);
    } else if (actual !== expected) {
      problems.push(`"${testName}" is ${actual}, expected ${expected}`);
    }
  }

  return {
    name,
    passed: problems.length === 0,
    detail: problems.length === 0 ? `ok (${testNames.length} test(s))` : problems.join("; "),
  };
}

function finalize(checks: ValidationCheck[]): ValidationReport {
  return { ok: checks.every((c) => c.passed), checks };
}
