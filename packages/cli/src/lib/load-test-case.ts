import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { type TestCase, TestCaseSchema } from "@agentgrader/core";
import { parse } from "yaml";
import { ZodError } from "zod";
import { formatZodError } from "./format-zod-error";
import { warnUnrecognizedKeys } from "./schema-warnings";

/**
 * Loads and parses an `agr.yaml` test case file.
 *
 * - Resolves `fixture` relative to the yaml file's directory.
 * - Resolves `solution` / `test_patch` (if they look like file paths rather
 *   than inline diffs) relative to the yaml file's directory and replaces
 *   them with the raw diff content, so downstream consumers (DiffScorer,
 *   RegressionScorer, validate, runner) can use them directly.
 */
export function loadTestCase(yamlPath: string): TestCase {
  const path = resolve(yamlPath);
  const fileContent = readFileSync(path, "utf-8");
  const raw = parse(fileContent);
  const dir = dirname(path);

  warnUnrecognizedKeys(TestCaseSchema, raw, `test case "${path}"`);

  if (
    raw.fixture &&
    !String(raw.fixture).startsWith("/") &&
    !String(raw.fixture).startsWith("http")
  ) {
    raw.fixture = resolve(dir, raw.fixture);
  }

  let testCase: TestCase;
  try {
    testCase = TestCaseSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(formatZodError(err, `test case "${path}"`));
    }
    throw err;
  }
  testCase.id = testCase.id || testCase.name;

  if (testCase.toolkits) {
    testCase.toolkits = testCase.toolkits.map((toolkit) =>
      isAbsolute(toolkit) ? toolkit : resolve(dir, toolkit),
    );
  }

  if (testCase.agent_config) {
    testCase.agent_config = isAbsolute(testCase.agent_config)
      ? testCase.agent_config
      : resolve(dir, testCase.agent_config);
  }

  if (testCase.solution && looksLikeFilePath(testCase.solution)) {
    testCase.solution = readPatchFile(dir, testCase.solution);
  }
  if (testCase.test_patch && looksLikeFilePath(testCase.test_patch)) {
    testCase.test_patch = readPatchFile(dir, testCase.test_patch);
  }

  return testCase;
}

export function resolveSharedAgentConfigFromTestCases(testCases: TestCase[]): string {
  if (testCases.length === 0) {
    throw new Error("No test cases loaded.");
  }

  const paths = new Set<string>();
  for (const tc of testCases) {
    if (!tc.agent_config) {
      throw new Error(
        "Either --configs, --configs-dir, --matrix, or --manifest must be provided, or every test case in the suite must define the same agent_config in agr.yaml.",
      );
    }
    paths.add(tc.agent_config);
  }

  if (paths.size > 1) {
    throw new Error(
      `Multiple agent_config values found across test cases (${[...paths].join(", ")}). Use --configs, --configs-dir, or --matrix to specify agent configs explicitly.`,
    );
  }

  return [...paths][0];
}

/** Heuristic: inline diffs contain newlines and/or start with diff markers. */
function looksLikeFilePath(value: string): boolean {
  const trimmed = value.trimStart();
  if (trimmed.startsWith("diff ") || trimmed.startsWith("---") || trimmed.startsWith("***")) {
    return false;
  }
  return !value.includes("\n");
}

function readPatchFile(dir: string, relPath: string): string {
  const full = isAbsolute(relPath) ? relPath : resolve(dir, relPath);
  try {
    return readFileSync(full, "utf-8");
  } catch (err: any) {
    throw new Error(`Failed to read patch file "${relPath}" (resolved to ${full}): ${err.message}`);
  }
}

/** Converts a parsed TestCase into a row suitable for `saveTestCase`. */
export function testCaseToDbRow(testCase: TestCase) {
  return {
    id: testCase.id || testCase.name,
    name: testCase.name,
    description: testCase.description,
    fixture: testCase.fixture,
    prompt: testCase.prompt,
    success: JSON.stringify(testCase.success),
    timeoutSeconds: testCase.timeout_seconds,
    createdAt: Math.floor(Date.now() / 1000),
    tags: testCase.tags ? JSON.stringify(testCase.tags) : null,
    testCommand: testCase.test_command ?? null,
    failToPass: testCase.fail_to_pass ? JSON.stringify(testCase.fail_to_pass) : null,
    passToPass: testCase.pass_to_pass ? JSON.stringify(testCase.pass_to_pass) : null,
    forbidModified: testCase.forbid_modified ? JSON.stringify(testCase.forbid_modified) : null,
    expectedFiles: testCase.expected_files ? JSON.stringify(testCase.expected_files) : null,
    solution: testCase.solution ?? null,
    testPatch: testCase.test_patch ?? null,
    sourceCreatedAt: testCase.created_at ?? null,
  };
}

/** Recursively finds `agr.yaml` (and other non-config `.yaml`) files under `dir`. */
export function findTestCaseYamlFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry !== "fixture" && entry !== "node_modules" && !entry.startsWith(".")) {
          files.push(...findTestCaseYamlFiles(fullPath));
        }
      } else if (
        entry === "agr.yaml" ||
        (entry.endsWith(".yaml") && !entry.includes("config"))
      ) {
        files.push(fullPath);
      }
    }
  } catch {
    // ignore unreadable directories
  }
  return files;
}
