import { validateTestCase } from "@agentgrader/core";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";
import { loadTestCase } from "../lib/load-test-case";

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
export async function validateCommand(testCasePath: string) {
  const testCase = loadTestCase(testCasePath);
  console.log(`Validating "${testCase.name}" (${testCasePath})...\n`);

  const sandboxProvider = new DockerSandboxProvider();
  const report = await validateTestCase({ testCase, sandboxProvider });

  for (const check of report.checks) {
    const icon = check.passed ? "✅" : "❌";
    console.log(`${icon} ${check.name}`);
    if (check.detail && check.detail !== "ok") {
      const indented = check.detail
        .split("\n")
        .map((line) => `   ${line}`)
        .join("\n");
      console.log(indented);
    }
  }

  console.log("");
  console.log(report.ok ? "✅ Validation passed." : "❌ Validation failed.");
  process.exit(report.ok ? 0 : 1);
}
