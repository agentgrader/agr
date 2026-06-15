import { relative, resolve } from "node:path";
import { findAllTestCases } from "../lib/load-test-case";

/**
 * `agr list-tests [dir]`
 *
 * Recursively scans `dir` (default: cwd) for test case files (`agr.yaml`
 * and similar) and prints their `name`, relative path, and description -
 * so a project with many test cases doesn't require memorizing paths.
 *
 * The printed `name` values (and each test case's directory basename) are
 * what `agr run`/`agr bench` accept as a short form instead of a full path.
 */
export async function listTestsCommand(dir: string | undefined) {
  const root = resolve(dir || ".");
  const testCases = findAllTestCases(root);

  if (testCases.length === 0) {
    console.log(`No test cases found under ${root}.`);
    console.log("Test cases are .yaml files with a `name:` and `success:` (e.g. agr.yaml).");
    return;
  }

  console.log(`Test cases under ${root} (${testCases.length} found):\n`);
  for (const tc of testCases) {
    console.log(`${tc.name}`);
    console.log(`  path: ${relative(root, tc.path)}`);
    if (tc.description) console.log(`  ${tc.description}`);
    console.log("");
  }
  console.log("Run one with `agr run <name>` or `agr run <path>`.");
}
