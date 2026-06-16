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
export async function listTestsCommand(dir: string | undefined, opts?: { json?: boolean }) {
  const root = resolve(dir || ".");
  const testCases = findAllTestCases(root);

  if (opts?.json) {
    const output = testCases.map(tc => ({
      name: tc.name,
      path: tc.path,
      relativePath: relative(root, tc.path),
      ...(tc.description ? { description: tc.description } : {}),
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (testCases.length === 0) {
    console.log(`No test cases found under ${root}.`);
    console.log("Test cases are .yaml files with a `name:` and `success:` (e.g. agr.yaml).");
    return;
  }

  const nameWidth = Math.min(Math.max(...testCases.map(tc => tc.name.length)), 36);
  const pathWidth = Math.min(Math.max(...testCases.map(tc => relative(root, tc.path).length)), 44);

  console.log(`Test cases under ${root} (${testCases.length} found):\n`);
  for (const tc of testCases) {
    const name = tc.name.padEnd(nameWidth);
    const path = relative(root, tc.path).padEnd(pathWidth);
    const desc = tc.description ? `  ${tc.description}` : "";
    console.log(`  ${name}  ${path}${desc}`);
  }
  console.log(`\nRun one with \`agr run <name>\` or \`agr run <path>\`.`);
}
