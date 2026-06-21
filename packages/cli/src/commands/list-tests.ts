import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { findAllTestCases } from "../lib/load-test-case";
import { initDb, listRuns } from "@agentgrader/store";

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
export async function listTestsCommand(dir: string | undefined, opts?: { json?: boolean; tags?: string[]; count?: boolean; name?: string; unrun?: boolean; db?: string }) {
  const root = resolve(dir || ".");
  let testCases = findAllTestCases(root);

  if (opts?.tags?.length) {
    const tagSet = new Set(opts.tags);
    testCases = testCases.filter(tc => (tc.tags ?? []).some(t => tagSet.has(t)));
  }

  if (opts?.name) {
    const nameFilter = opts.name.toLowerCase();
    testCases = testCases.filter(tc => tc.name.toLowerCase().includes(nameFilter));
  }

  if (opts?.unrun) {
    const dbPath = opts.db ?? ".agr/db.sqlite";
    const runTestCaseIds = new Set<string>();
    if (existsSync(resolve(dbPath))) {
      const db = initDb(dbPath);
      const runs = await listRuns(db);
      for (const r of runs) runTestCaseIds.add(r.testCaseId);
    }
    testCases = testCases.filter((tc) => !runTestCaseIds.has(tc.name));
    if (opts?.count) {
      console.log(String(testCases.length));
      return;
    }
    if (opts?.json) {
      const output = testCases.map(tc => ({
        name: tc.name,
        path: tc.path,
        relativePath: relative(root, tc.path),
        ...(tc.description ? { description: tc.description } : {}),
        ...(tc.tags?.length ? { tags: tc.tags } : {}),
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    if (testCases.length === 0) {
      console.log("All test cases have at least one recorded run. Nothing unrun.");
      return;
    }
    console.log(`Unrun test cases (${testCases.length} with no recorded runs):\n`);
    for (const tc of testCases) {
      console.log(`  ${tc.name}  ${relative(root, tc.path)}`);
    }
    console.log(`\nRun with \`agr bench --suite ${relative(process.cwd(), root) || root}\` or \`agr run <name>\`.`);
    return;
  }

  if (opts?.count) {
    console.log(String(testCases.length));
    return;
  }

  if (opts?.json) {
    const output = testCases.map(tc => ({
      name: tc.name,
      path: tc.path,
      relativePath: relative(root, tc.path),
      ...(tc.description ? { description: tc.description } : {}),
      ...(tc.tags?.length ? { tags: tc.tags } : {}),
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (testCases.length === 0) {
    const tagHint = opts?.tags?.length ? ` with tags [${opts.tags.join(", ")}]` : "";
    console.log(`No test cases found${tagHint} under ${root}.`);
    if (!opts?.tags?.length) {
      console.log("Test cases are .yaml files with a `name:` and `success:` (e.g. agr.yaml).");
    }
    return;
  }

  const tagSuffix = opts?.tags?.length ? ` [tags: ${opts.tags.join(", ")}]` : "";
  const nameWidth = Math.min(Math.max(...testCases.map(tc => tc.name.length)), 36);
  const pathWidth = Math.min(Math.max(...testCases.map(tc => relative(root, tc.path).length)), 44);
  const anyTags = testCases.some(tc => tc.tags?.length);

  console.log(`Test cases under ${root} (${testCases.length} found)${tagSuffix}:\n`);
  for (const tc of testCases) {
    const name = tc.name.padEnd(nameWidth);
    const path = relative(root, tc.path).padEnd(pathWidth);
    const desc = tc.description ? `  ${tc.description}` : "";
    const tags = anyTags && tc.tags?.length ? `  [${tc.tags.join(", ")}]` : "";
    console.log(`  ${name}  ${path}${desc}${tags}`);
  }
  if (opts?.tags?.length) {
    const tagArg = opts.tags.join(",");
    console.log(`\nRun all with \`agr bench --suite ${relative(process.cwd(), root) || root} --tags ${tagArg}\`  |  Run one with \`agr run <name>\`.`);
  } else if (testCases.length > 1) {
    const relRoot = relative(process.cwd(), root) || root;
    console.log(`\nRun all with \`agr bench --suite ${relRoot}\`  |  Run one with \`agr run <name>\`.`);
  } else {
    console.log(`\nRun with \`agr run <name>\` or \`agr run <path>\`.`);
  }
}
