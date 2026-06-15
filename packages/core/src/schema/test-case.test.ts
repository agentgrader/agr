import { describe, expect, test } from "bun:test";
import { SuccessCriterionSchema, TestCaseSchema } from "./test-case";

describe("SuccessCriterionSchema", () => {
  test("accepts a run+expect criterion and defaults exit_code to 0", () => {
    const result = SuccessCriterionSchema.parse({
      run: "npm test",
      expect: {},
    });
    expect(result).toEqual({ run: "npm test", expect: { exit_code: 0 } });
  });

  test("accepts a run+expect criterion with an explicit exit_code", () => {
    const result = SuccessCriterionSchema.parse({
      run: "npm test",
      expect: { exit_code: 1 },
    });
    expect(result).toEqual({ run: "npm test", expect: { exit_code: 1 } });
  });

  test("accepts an assert criterion", () => {
    const result = SuccessCriterionSchema.parse({ assert: "file exists" });
    expect(result).toEqual({ assert: "file exists" });
  });

  test("rejects a criterion that is neither run+expect nor assert", () => {
    expect(() => SuccessCriterionSchema.parse({ foo: "bar" })).toThrow();
  });
});

describe("TestCaseSchema", () => {
  const minimal = {
    name: "cleanup-unused-import",
    fixture: "./fixtures/cleanup-unused-import",
    prompt: "Remove the unused import.",
    success: [{ assert: "no unused imports remain" }],
  };

  test("accepts a minimal test case and defaults timeout_seconds to 300", () => {
    const result = TestCaseSchema.parse(minimal);
    expect(result.timeout_seconds).toBe(300);
    expect(result.id).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  test("rejects a test case missing required fields", () => {
    expect(() => TestCaseSchema.parse({ ...minimal, name: undefined })).toThrow();
    expect(() => TestCaseSchema.parse({ ...minimal, fixture: undefined })).toThrow();
    expect(() => TestCaseSchema.parse({ ...minimal, prompt: undefined })).toThrow();
    expect(() => TestCaseSchema.parse({ ...minimal, success: undefined })).toThrow();
  });

  test("accepts SWE-bench-style optional fields", () => {
    const result = TestCaseSchema.parse({
      ...minimal,
      tags: ["swe-bench"],
      test_command: "pytest -v",
      fail_to_pass: ["test_foo"],
      pass_to_pass: ["test_bar"],
      forbid_modified: ["tests/**"],
      expected_files: ["src/**"],
      solution: "./solution.patch",
      test_patch: "./test.patch",
      created_at: "2024-01-01",
      image: "python:3.12",
      toolkits: ["./toolkits/jetbrains-tools"],
      agent_config: "./agent.yaml",
    });
    expect(result.tags).toEqual(["swe-bench"]);
    expect(result.fail_to_pass).toEqual(["test_foo"]);
    expect(result.pass_to_pass).toEqual(["test_bar"]);
    expect(result.toolkits).toEqual(["./toolkits/jetbrains-tools"]);
    expect(result.agent_config).toBe("./agent.yaml");
  });

  test("accepts multiple success criteria of mixed kinds", () => {
    const result = TestCaseSchema.parse({
      ...minimal,
      success: [{ run: "npm test", expect: { exit_code: 0 } }, { assert: "diff is non-empty" }],
    });
    expect(result.success).toHaveLength(2);
  });

  test("accepts optional llm-judge rubrics", () => {
    const result = TestCaseSchema.parse({
      ...minimal,
      rubrics: [
        { id: "correctness", prompt: "Is the patch correct?", scale: "0-1", weight: 2 },
        { id: "style", prompt: "Is the code style acceptable?" },
      ],
    });
    expect(result.rubrics).toEqual([
      { id: "correctness", prompt: "Is the patch correct?", scale: "0-1", weight: 2 },
      { id: "style", prompt: "Is the code style acceptable?", scale: "0-1", weight: 1 },
    ]);
  });
});
