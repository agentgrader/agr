import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { validateCommand } from "./validate";

const TEST_FILE_PATTERN = /(^|\/)(tests?|specs?|__tests__)(\/|$)|\.(test|spec)\.[jt]sx?$/i;

interface PullRequestInfo {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  base: { sha: string; ref: string };
  head: { sha: string; ref: string };
}

/**
 * `agr import-pr <owner/repo> <pr-number> [--out <dir>] [--clone-fixture] [--validate]`
 *
 * Scaffolds a new test case from a merged GitHub pull request, mirroring
 * SWE-bench's PR-scraping construction pipeline:
 *
 *  - The PR's diff is split into a gold `solution.patch` (non-test files)
 *    and a `test_patch.patch` (test files), based on common test path
 *    conventions.
 *  - `expected_files` / `forbid_modified` are pre-filled from those file
 *    lists for the localization scorer and tamper guard.
 *  - `created_at` is taken from the PR for contamination/date-cutoff checks.
 *  - `test_command`, `fail_to_pass`, and `pass_to_pass` are left as TODO
 *    placeholders - these require actually running the test suite (use
 *    `agr validate` after filling in the fixture).
 *
 * With `--clone-fixture`, the repo is cloned and checked out at the PR's
 * `base.sha` into `<outDir>/fixture`, so the test case is immediately
 * runnable (modulo the `test_command`/`fail_to_pass`/`pass_to_pass` TODOs).
 *
 * With `--validate`, `agr validate` is run against the scaffolded
 * `agr.yaml` once it's written (most useful combined with
 * `--clone-fixture`, and after filling in the TODO fields).
 *
 * Set `GITHUB_TOKEN` in the environment to avoid GitHub's low unauthenticated
 * rate limits.
 */
export async function importPrCommand(
  repo: string,
  prNumber: string,
  opts: { out?: string; cloneFixture?: boolean; validate?: boolean },
) {
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    throw new Error(`Invalid repo "${repo}" - expected format "owner/repo".`);
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "agentgrader-import-pr",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}`;

  console.log(`Fetching PR #${prNumber} from ${owner}/${repoName}...`);
  const prRes = await fetch(apiUrl, { headers });
  if (!prRes.ok) {
    throw new Error(`Failed to fetch PR metadata: ${prRes.status} ${prRes.statusText}`);
  }
  const pr = (await prRes.json()) as PullRequestInfo;

  console.log("Fetching PR diff...");
  const diffRes = await fetch(apiUrl, {
    headers: { ...headers, Accept: "application/vnd.github.v3.diff" },
  });
  if (!diffRes.ok) {
    throw new Error(`Failed to fetch PR diff: ${diffRes.status} ${diffRes.statusText}`);
  }
  const fullDiff = await diffRes.text();

  const { solutionDiff, testDiff, expectedFiles, forbidModified } = splitDiff(fullDiff);

  const slug = `${repoName}-pr-${pr.number}`;
  const outDir = resolve(opts.out || `./imported/${slug}`);
  mkdirSync(outDir, { recursive: true });

  if (solutionDiff.trim()) {
    writeFileSync(resolve(outDir, "solution.patch"), solutionDiff);
  }
  if (testDiff.trim()) {
    writeFileSync(resolve(outDir, "test_patch.patch"), testDiff);
  }

  const yamlDoc: Record<string, any> = {
    name: slug,
    description: pr.title,
    fixture: "./fixture",
    prompt: buildPrompt(pr),
    success: [{ run: "npm install && npm test", expect: { exit_code: 0 } }],
    timeout_seconds: 600,
    tags: ["imported", repoName],
    created_at: pr.created_at,
    // TODO: fill these in after setting up ./fixture (checked out at
    // base.sha below) and running the test suite to discover real test names.
    test_command: "<TODO: e.g. tsx --test --test-reporter=tap src/**/*.test.ts>",
    fail_to_pass: ["<TODO: fill in via `agr validate`>"],
    pass_to_pass: ["<TODO: fill in via `agr validate`>"],
  };

  if (solutionDiff.trim()) yamlDoc.solution = "./solution.patch";
  if (testDiff.trim()) yamlDoc.test_patch = "./test_patch.patch";
  if (expectedFiles.length > 0) yamlDoc.expected_files = expectedFiles;
  if (forbidModified.length > 0) yamlDoc.forbid_modified = forbidModified;

  writeFileSync(resolve(outDir, "agr.yaml"), stringify(yamlDoc));

  console.log(`\nImported PR #${pr.number}: "${pr.title}"`);
  console.log(`Wrote scaffold to: ${outDir}`);
  console.log("  - agr.yaml");
  if (solutionDiff.trim())
    console.log(`  - solution.patch (${expectedFiles.length} file(s) changed)`);
  if (testDiff.trim())
    console.log(`  - test_patch.patch (${forbidModified.length} test file(s) changed)`);

  if (opts.cloneFixture) {
    const fixtureDir = resolve(outDir, "fixture");
    console.log(`\nCloning ${owner}/${repoName} into ${fixtureDir}...`);
    execFileSync("git", ["clone", `https://github.com/${owner}/${repoName}.git`, fixtureDir], {
      stdio: "inherit",
    });
    console.log(`Checking out base commit ${pr.base.sha}...`);
    execFileSync("git", ["checkout", pr.base.sha], { cwd: fixtureDir, stdio: "inherit" });
  }

  console.log("\nNext steps:");
  if (!opts.cloneFixture) {
    console.log(`  1. Check out ${owner}/${repoName}@${pr.base.sha} into ${outDir}/fixture`);
    console.log("  2. Fill in test_command, fail_to_pass, and pass_to_pass in agr.yaml");
    console.log(
      `  3. Run "agr validate ${resolve(outDir, "agr.yaml")}" to verify the test case`,
    );
  } else {
    console.log("  1. Fill in test_command, fail_to_pass, and pass_to_pass in agr.yaml");
    console.log(
      `  2. Run "agr validate ${resolve(outDir, "agr.yaml")}" to verify the test case`,
    );
  }

  if (opts.validate) {
    console.log("\nRunning validation...\n");
    await validateCommand(resolve(outDir, "agr.yaml"));
  }
}

function buildPrompt(pr: PullRequestInfo): string {
  const body = (pr.body || "").trim();
  return body ? `${pr.title}\n\n${body}` : pr.title;
}

/**
 * splits a unified diff into "solution" (non-test files) and "test"
 * (test files) chunks based on common test path conventions, and collects
 * the touched file paths for `expected_files` / `forbid_modified`.
 */
function splitDiff(diff: string): {
  solutionDiff: string;
  testDiff: string;
  expectedFiles: string[];
  forbidModified: string[];
} {
  const fileDiffs = diff.split(/(?=^diff --git )/m).filter((d) => d.trim().length > 0);

  const solutionParts: string[] = [];
  const testParts: string[] = [];
  const expectedFiles: string[] = [];
  const forbidModified: string[] = [];

  for (const fileDiff of fileDiffs) {
    const match = fileDiff.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const path = match?.[2];

    if (path && TEST_FILE_PATTERN.test(path)) {
      testParts.push(fileDiff);
      forbidModified.push(path);
    } else {
      solutionParts.push(fileDiff);
      if (path) expectedFiles.push(path);
    }
  }

  return {
    solutionDiff: solutionParts.join(""),
    testDiff: testParts.join(""),
    expectedFiles,
    forbidModified,
  };
}
