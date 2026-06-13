import { type ValidationCheck, validateTestCase } from "@agentgrader/core";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";
import { loadTestCase } from "../lib/load-test-case";

function isSkippedCheck(check: ValidationCheck): boolean {
  return (
    check.name.toLowerCase().includes("(skipped") ||
    check.detail.toLowerCase().includes("skipping")
  );
}

function checkIcon(check: ValidationCheck): string {
  if (!check.passed) return "[FAIL]";
  if (isSkippedCheck(check)) return "[WARN]";
  return "[OK]";
}

/**
 * `agr validate <testCase>`
 *
 * Runs the SWE-bench-style validation pipeline against a test case
 * definition: static field checks, then (if a `test_command` is
 * configured) a pre-patch run verifying FAIL_TO_PASS tests currently fail
 * and PASS_TO_PASS tests currently pass, and - if a gold `solution` patch
 * is provided - a post-patch run verifying the gold patch actually fixes
 * FAIL_TO_PASS without breaking PASS_TO_PASS.
 */
export async function validateCommand(testCasePath: string, opts?: { strict?: boolean }) {
  const testCase = loadTestCase(testCasePath);

  if (opts?.strict) {
    const missing: string[] = [];
    if (!testCase.test_command) missing.push("test_command");
    if (!testCase.fail_to_pass?.length) missing.push("fail_to_pass");
    if (!testCase.pass_to_pass?.length) missing.push("pass_to_pass");
    if (missing.length > 0) {
      console.error(
        `Strict validation requires: ${missing.join(", ")}. Fill these fields before running in CI.`,
      );
      process.exit(1);
    }
  }

  console.log(`Validating "${testCase.name}" (${testCasePath})...\n`);

  const sandboxProvider = new DockerSandboxProvider();
  const report = await validateTestCase({ testCase, sandboxProvider });

  const hadExecutionSkip = report.checks.some((c) =>
    c.name.includes("execution-checks (skipped"),
  );
  for (const check of report.checks) {
    const icon = checkIcon(check);
    console.log(`${icon} ${check.name}`);
    if (check.detail && check.detail !== "ok") {
      const indented = check.detail
        .split("\n")
        .map((line) => `   ${line}`)
        .join("\n");
      console.log(indented);
    }
  }

  if (hadExecutionSkip) {
    console.log("");
    console.log(
      "Note: this was a static-only validation (no test_command configured) - Docker/patch execution checks were skipped.",
    );
    if (report.ok && !opts?.strict) {
      console.log(
        "Tip: run with --strict to enforce test_command, fail_to_pass, and pass_to_pass as a CI gate.",
      );
    }
  }

  console.log("");
  console.log(report.ok ? "Validation passed." : "Validation failed.");
  process.exit(report.ok ? 0 : 1);
}
