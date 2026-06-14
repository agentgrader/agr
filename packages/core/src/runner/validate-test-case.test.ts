import { describe, expect, test } from "bun:test";
import type { SandboxProvider } from "../adapters/sandbox-provider";
import type { TestCase } from "../schema/test-case";
import { validateTestCase } from "./validate-test-case";

// validateTestCase only touches `sandboxProvider` when `test_command` is
// set (see runner/validate-test-case.ts) - every test below omits
// `test_command`, so this never-called stub is enough.
const unusedSandboxProvider = {} as SandboxProvider;

function baseTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    name: "fix-greeting",
    fixture: "./fixture",
    prompt: "Fix the greeting.",
    success: [],
    timeout_seconds: 300,
    ...overrides,
  };
}

function detailFor(report: Awaited<ReturnType<typeof validateTestCase>>, name: string): string | undefined {
  return report.checks.find((c) => c.name === name)?.detail;
}

describe("validateTestCase (static checks, no test_command)", () => {
  test("passes for a minimal valid test case", async () => {
    const report = await validateTestCase({
      testCase: baseTestCase(),
      sandboxProvider: unusedSandboxProvider,
    });

    expect(report.ok).toBe(true);
    expect(report.checks).toContainEqual({ name: "has name and prompt", passed: true, detail: "ok" });
    expect(detailFor(report, "execution-checks (skipped - no test_command)")).toBe(
      "No test_command configured; skipping pre/post-patch execution checks.",
    );
  });

  test("fails when name and prompt are missing", async () => {
    const report = await validateTestCase({
      testCase: baseTestCase({ name: "", prompt: "" }),
      sandboxProvider: unusedSandboxProvider,
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({
      name: "has name and prompt",
      passed: false,
      detail: "Test case is missing `name` and/or `prompt`.",
    });
  });

  test("flags fail_to_pass/pass_to_pass set without test_command", async () => {
    const report = await validateTestCase({
      testCase: baseTestCase({ fail_to_pass: ["test_foo"] }),
      sandboxProvider: unusedSandboxProvider,
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({
      name: "test_command configured for fail_to_pass/pass_to_pass",
      passed: false,
      detail: "fail_to_pass/pass_to_pass are set but no test_command was provided.",
    });
  });

  test("flags overlap between fail_to_pass and pass_to_pass", async () => {
    const report = await validateTestCase({
      testCase: baseTestCase({
        fail_to_pass: ["test_foo", "test_shared"],
        pass_to_pass: ["test_shared"],
      }),
      sandboxProvider: unusedSandboxProvider,
    });

    expect(report.checks).toContainEqual({
      name: "fail_to_pass and pass_to_pass do not overlap",
      passed: false,
      detail: "Tests listed in both sets: test_shared",
    });
  });

  test("passes when fail_to_pass and pass_to_pass don't overlap", async () => {
    const report = await validateTestCase({
      testCase: baseTestCase({
        fail_to_pass: ["test_foo"],
        pass_to_pass: ["test_bar"],
      }),
      sandboxProvider: unusedSandboxProvider,
    });

    expect(report.checks).toContainEqual({
      name: "fail_to_pass and pass_to_pass do not overlap",
      passed: true,
      detail: "ok",
    });
  });

  test("flags suspicious forbid_modified / expected_files glob patterns", async () => {
    const report = await validateTestCase({
      testCase: baseTestCase({
        forbid_modified: ["src/**/*.ts", ""],
        expected_files: ["  "],
      }),
      sandboxProvider: unusedSandboxProvider,
    });

    expect(report.checks).toContainEqual({
      name: "forbid_modified patterns look valid",
      passed: false,
      detail: 'Suspicious glob pattern(s): ',
    });
    expect(report.checks).toContainEqual({
      name: "expected_files patterns look valid",
      passed: false,
      detail: "Suspicious glob pattern(s):   ",
    });
  });

  test("passes valid forbid_modified / expected_files glob patterns", async () => {
    const report = await validateTestCase({
      testCase: baseTestCase({
        forbid_modified: ["tests/**", "*.lock"],
        expected_files: ["src/index.ts"],
      }),
      sandboxProvider: unusedSandboxProvider,
    });

    expect(report.checks).toContainEqual({
      name: "forbid_modified patterns look valid",
      passed: true,
      detail: "ok",
    });
    expect(report.checks).toContainEqual({
      name: "expected_files patterns look valid",
      passed: true,
      detail: "ok",
    });
  });

  test("validates created_at as a parseable date", async () => {
    const valid = await validateTestCase({
      testCase: baseTestCase({ created_at: "2024-01-15" }),
      sandboxProvider: unusedSandboxProvider,
    });
    expect(detailFor(valid, "created_at is a parseable date (contamination/date-cutoff check)")).toBe(
      "ok (2024-01-15T00:00:00.000Z)",
    );

    const invalid = await validateTestCase({
      testCase: baseTestCase({ created_at: "not-a-date" }),
      sandboxProvider: unusedSandboxProvider,
    });
    expect(invalid.checks).toContainEqual({
      name: "created_at is a parseable date (contamination/date-cutoff check)",
      passed: false,
      detail: 'Could not parse created_at: "not-a-date"',
    });
  });
});
