import { type ValidationCheck, validateTestCase, auditToolkitDirectory, hasAuditErrors } from "@agentgrader/core";
import { resolve } from "node:path";
import { resolveSandbox } from "../lib/resolve-sandbox";
import { findTestCaseYamlFiles, loadTestCase, resolveTestCasePath } from "../lib/load-test-case";

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
 * `agr validate [...testCases]`
 *
 * Runs the SWE-bench-style validation pipeline against one or more test
 * case definitions: static field checks, then (if a `test_command` is
 * configured) a pre-patch run verifying FAIL_TO_PASS tests currently fail
 * and PASS_TO_PASS tests currently pass, and - if a gold `solution` patch
 * is provided - a post-patch run verifying the gold patch actually fixes
 * FAIL_TO_PASS without breaking PASS_TO_PASS.
 *
 * When multiple test cases are given, each is validated in turn and the
 * command exits 1 if any failed.
 */
async function validateOne(
  input: string,
  opts: { strict?: boolean; sandbox?: string; auditToolkits?: boolean },
  sandboxProvider: ReturnType<typeof resolveSandbox>,
): Promise<boolean> {
  const resolvedPath = resolveTestCasePath(input);
  const testCase = loadTestCase(resolvedPath);

  if (opts.strict) {
    const missing: string[] = [];
    if (!testCase.test_command) missing.push("test_command");
    if (!testCase.fail_to_pass?.length) missing.push("fail_to_pass");
    if (!testCase.pass_to_pass?.length) missing.push("pass_to_pass");
    if (missing.length > 0) {
      console.error(
        `Strict validation requires: ${missing.join(", ")}. Fill these fields before running in CI.`,
      );
      return false;
    }
  }

  if (opts.auditToolkits && testCase.toolkits?.length) {
    const yamlDir = resolve(resolvedPath, "..");
    for (const toolkit of testCase.toolkits) {
      const findings = auditToolkitDirectory(resolve(yamlDir, toolkit));
      for (const finding of findings) {
        const label = finding.severity === "error" ? "[FAIL]" : "[WARN]";
        console.log(`${label} toolkit ${toolkit}: ${finding.message} (${finding.rule})`);
      }
      if (hasAuditErrors(findings)) return false;
    }
  }

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
    if (report.ok && !opts.strict) {
      console.log(
        "Tip: run with --strict to enforce test_command, fail_to_pass, and pass_to_pass as a CI gate.",
      );
    }
  }

  console.log("");
  console.log(report.ok ? "Validation passed." : "Validation failed.");
  return report.ok;
}

export async function validateCommand(
  testCasePaths: string | string[],
  opts?: { strict?: boolean; sandbox?: string; auditToolkits?: boolean; suite?: string },
) {
  const sandboxProvider = resolveSandbox(opts?.sandbox ?? "docker");
  const safeOpts = opts ?? {};

  let resolvedPaths: string[];

  if (opts?.suite) {
    const suiteDir = resolve(opts.suite);
    const yamlFiles = findTestCaseYamlFiles(suiteDir);
    if (yamlFiles.length === 0) {
      console.error(`No test cases found in suite directory: ${suiteDir}`);
      process.exit(1);
    }
    resolvedPaths = yamlFiles;
    console.log(`Validating ${yamlFiles.length} test case(s) from suite: ${suiteDir}\n`);
  } else {
    const inputs = Array.isArray(testCasePaths) ? testCasePaths : [testCasePaths];
    if (inputs.length === 0) {
      console.error("No test case specified. Usage: agr validate <testCase> [testCase...] or --suite <dir>");
      process.exit(1);
    }
    resolvedPaths = inputs.map(i => resolveTestCasePath(i));
  }

  if (resolvedPaths.length === 1) {
    const testCase = loadTestCase(resolvedPaths[0]!);
    console.log(`Validating "${testCase.name}" (${resolvedPaths[0]})...\n`);
    const ok = await validateOne(resolvedPaths[0]!, safeOpts, sandboxProvider);
    process.exit(ok ? 0 : 1);
  }

  let passCount = 0;
  for (const path of resolvedPaths) {
    const testCase = loadTestCase(path);
    console.log(`\n--- ${testCase.name} (${path}) ---\n`);
    const ok = await validateOne(path, safeOpts, sandboxProvider);
    if (ok) passCount++;
  }

  const failCount = resolvedPaths.length - passCount;
  console.log(
    failCount === 0
      ? `\nAll ${resolvedPaths.length} validations passed.`
      : `\n${passCount}/${resolvedPaths.length} validations passed, ${failCount} failed.`,
  );
  process.exit(failCount > 0 ? 1 : 0);
}
