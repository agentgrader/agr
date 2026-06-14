import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  findTestCaseYamlFiles,
  loadTestCase,
  resolveSharedAgentConfigFromTestCases,
  testCaseToDbRow,
} from "./load-test-case";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agr-load-test-case-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeYaml(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("loadTestCase", () => {
  test("parses a minimal test case and resolves the fixture path", () => {
    const path = writeYaml(
      "agr.yaml",
      `
name: fix-the-bug
fixture: ./fixture
prompt: Fix the bug.
success:
  - run: pytest
    expect:
      exit_code: 0
`,
    );

    const tc = loadTestCase(path);
    expect(tc.name).toBe("fix-the-bug");
    expect(tc.fixture).toBe(resolve(dir, "fixture"));
    expect(tc.id).toBe("fix-the-bug");
    expect(tc.timeout_seconds).toBe(300);
  });

  test("does not rewrite absolute or http fixture paths", () => {
    const absPath = writeYaml(
      "agr.yaml",
      `
name: abs-fixture
fixture: /tmp/some-fixture
prompt: do it
success: []
`,
    );
    expect(loadTestCase(absPath).fixture).toBe("/tmp/some-fixture");

    const httpPath = writeYaml(
      "agr2.yaml",
      `
name: http-fixture
fixture: https://example.com/fixture.tar
prompt: do it
success: []
`,
    );
    expect(loadTestCase(httpPath).fixture).toBe("https://example.com/fixture.tar");
  });

  test("keeps an explicit id rather than falling back to name", () => {
    const path = writeYaml(
      "agr.yaml",
      `
id: custom-id
name: fix-the-bug
fixture: ./fixture
prompt: Fix the bug.
success: []
`,
    );

    expect(loadTestCase(path).id).toBe("custom-id");
  });

  test("resolves toolkits and agent_config relative to the yaml file", () => {
    const path = writeYaml(
      "agr.yaml",
      `
name: with-toolkits
fixture: ./fixture
prompt: do it
success: []
toolkits:
  - ./toolkits/foo
  - /abs/toolkits/bar
agent_config: ./agent.yaml
`,
    );

    const tc = loadTestCase(path);
    expect(tc.toolkits).toEqual([resolve(dir, "toolkits/foo"), "/abs/toolkits/bar"]);
    expect(tc.agent_config).toBe(resolve(dir, "agent.yaml"));
  });

  test("reads solution and test_patch from files when they look like paths", () => {
    writeFileSync(join(dir, "solution.patch"), "diff --git a/foo b/foo\n+hello\n");
    writeFileSync(join(dir, "tests.patch"), "diff --git a/test_foo b/test_foo\n+world\n");

    const path = writeYaml(
      "agr.yaml",
      `
name: with-patches
fixture: ./fixture
prompt: do it
success: []
solution: ./solution.patch
test_patch: ./tests.patch
`,
    );

    const tc = loadTestCase(path);
    expect(tc.solution).toBe("diff --git a/foo b/foo\n+hello\n");
    expect(tc.test_patch).toBe("diff --git a/test_foo b/test_foo\n+world\n");
  });

  test("leaves inline diffs for solution/test_patch untouched", () => {
    const inlineDiff = "diff --git a/foo b/foo\n+hello\n";
    const path = writeYaml(
      "agr.yaml",
      `
name: inline-patch
fixture: ./fixture
prompt: do it
success: []
solution: |
  diff --git a/foo b/foo
  +hello
`,
    );

    expect(loadTestCase(path).solution).toBe(inlineDiff);
  });

  test("throws a readable error for an invalid test case", () => {
    const path = writeYaml(
      "agr.yaml",
      `
name: missing-required-fields
`,
    );

    expect(() => loadTestCase(path)).toThrow(/test case/);
  });

  test("throws when a referenced patch file does not exist", () => {
    const path = writeYaml(
      "agr.yaml",
      `
name: missing-patch
fixture: ./fixture
prompt: do it
success: []
solution: ./does-not-exist.patch
`,
    );

    expect(() => loadTestCase(path)).toThrow(/Failed to read patch file/);
  });
});

describe("resolveSharedAgentConfigFromTestCases", () => {
  test("throws when given no test cases", () => {
    expect(() => resolveSharedAgentConfigFromTestCases([])).toThrow("No test cases loaded.");
  });

  test("throws when a test case has no agent_config", () => {
    const path = writeYaml(
      "agr.yaml",
      `
name: no-agent-config
fixture: ./fixture
prompt: do it
success: []
`,
    );
    const tc = loadTestCase(path);

    expect(() => resolveSharedAgentConfigFromTestCases([tc])).toThrow(
      /--configs, --configs-dir, --matrix, or --manifest/,
    );
  });

  test("throws when test cases reference different agent configs", () => {
    const pathA = writeYaml(
      "a.yaml",
      `
name: a
fixture: ./fixture
prompt: do it
success: []
agent_config: ./agent-a.yaml
`,
    );
    const pathB = writeYaml(
      "b.yaml",
      `
name: b
fixture: ./fixture
prompt: do it
success: []
agent_config: ./agent-b.yaml
`,
    );

    expect(() =>
      resolveSharedAgentConfigFromTestCases([loadTestCase(pathA), loadTestCase(pathB)]),
    ).toThrow(/Multiple agent_config values found/);
  });

  test("returns the shared agent_config path when all test cases agree", () => {
    const pathA = writeYaml(
      "a.yaml",
      `
name: a
fixture: ./fixture
prompt: do it
success: []
agent_config: ./agent.yaml
`,
    );
    const pathB = writeYaml(
      "b.yaml",
      `
name: b
fixture: ./fixture
prompt: do it
success: []
agent_config: ./agent.yaml
`,
    );

    expect(
      resolveSharedAgentConfigFromTestCases([loadTestCase(pathA), loadTestCase(pathB)]),
    ).toBe(resolve(dir, "agent.yaml"));
  });
});

describe("testCaseToDbRow", () => {
  test("maps a test case to a db row, JSON-encoding array fields", () => {
    const path = writeYaml(
      "agr.yaml",
      `
name: full-test-case
description: a full test case
fixture: ./fixture
prompt: do it
success: []
tags: [a, b]
test_command: pytest
fail_to_pass: ["test_a"]
pass_to_pass: ["test_b"]
forbid_modified: ["tests/*"]
expected_files: ["src/foo.py"]
created_at: "2024-01-01"
`,
    );

    const row = testCaseToDbRow(loadTestCase(path));
    expect(row.id).toBe("full-test-case");
    expect(row.name).toBe("full-test-case");
    expect(row.description).toBe("a full test case");
    expect(row.fixture).toBe(resolve(dir, "fixture"));
    expect(row.success).toBe("[]");
    expect(row.timeoutSeconds).toBe(300);
    expect(row.tags).toBe(JSON.stringify(["a", "b"]));
    expect(row.testCommand).toBe("pytest");
    expect(row.failToPass).toBe(JSON.stringify(["test_a"]));
    expect(row.passToPass).toBe(JSON.stringify(["test_b"]));
    expect(row.forbidModified).toBe(JSON.stringify(["tests/*"]));
    expect(row.expectedFiles).toBe(JSON.stringify(["src/foo.py"]));
    expect(row.sourceCreatedAt).toBe("2024-01-01");
    expect(typeof row.createdAt).toBe("number");
  });

  test("uses null for absent optional fields", () => {
    const path = writeYaml(
      "agr.yaml",
      `
name: minimal
fixture: ./fixture
prompt: do it
success: []
`,
    );

    const row = testCaseToDbRow(loadTestCase(path));
    expect(row.tags).toBeNull();
    expect(row.testCommand).toBeNull();
    expect(row.failToPass).toBeNull();
    expect(row.passToPass).toBeNull();
    expect(row.forbidModified).toBeNull();
    expect(row.expectedFiles).toBeNull();
    expect(row.solution).toBeNull();
    expect(row.testPatch).toBeNull();
    expect(row.sourceCreatedAt).toBeNull();
  });
});

describe("findTestCaseYamlFiles", () => {
  test("finds agr.yaml files recursively and skips fixture/node_modules/dot directories", () => {
    mkdirSync(join(dir, "task-a"), { recursive: true });
    mkdirSync(join(dir, "task-a", "fixture"), { recursive: true });
    mkdirSync(join(dir, "task-b", "nested"), { recursive: true });
    mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
    mkdirSync(join(dir, ".hidden"), { recursive: true });

    writeFileSync(join(dir, "task-a", "agr.yaml"), "name: a\n");
    writeFileSync(join(dir, "task-a", "fixture", "agr.yaml"), "name: should-be-skipped\n");
    writeFileSync(join(dir, "task-b", "nested", "agr.yaml"), "name: b\n");
    writeFileSync(join(dir, "node_modules", "pkg", "agr.yaml"), "name: should-be-skipped\n");
    writeFileSync(join(dir, ".hidden", "agr.yaml"), "name: should-be-skipped\n");

    const files = findTestCaseYamlFiles(dir).sort();
    expect(files).toEqual(
      [join(dir, "task-a", "agr.yaml"), join(dir, "task-b", "nested", "agr.yaml")].sort(),
    );
  });

  test("includes other .yaml files but excludes ones with 'config' in the name", () => {
    mkdirSync(join(dir, "task"), { recursive: true });
    writeFileSync(join(dir, "task", "extra.yaml"), "name: extra\n");
    writeFileSync(join(dir, "task", "agent-config.yaml"), "model: claude-haiku-4-5\n");

    const files = findTestCaseYamlFiles(dir);
    expect(files).toEqual([join(dir, "task", "extra.yaml")]);
  });

  test("returns an empty array for an unreadable directory", () => {
    expect(findTestCaseYamlFiles(join(dir, "does-not-exist"))).toEqual([]);
  });
});
