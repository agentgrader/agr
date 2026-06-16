import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

type ProjectKind = "python" | "node" | "go" | "unknown";

type TestCommandHint = "python" | "jest" | "ava" | "vitest" | "node-unknown" | "go" | "none";

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
 *  - `test_command`, `fail_to_pass`, and `pass_to_pass` must be filled in
 *    manually (or by an agent) after running the test suite; `agr validate`
 *    only checks the resulting definition, it does not populate these fields.
 *
 * Language/test-command auto-detection (Python/Node/Go defaults) only runs
 * when `--clone-fixture` is set, since it requires inspecting the checked-out
 * repo. Without `--clone-fixture`, all test fields remain TODO placeholders.
 *
 * With `--clone-fixture`, the repo is cloned and checked out at the PR's
 * `base.sha` into `<outDir>/fixture`, and `success` / `test_command` are
 * guessed from the fixture layout when possible.
 *
 * With `--validate`, `agr validate` is run against the scaffolded
 * `agr.yaml` once it's written (most useful combined with `--clone-fixture`,
 * after `test_command` and test-name lists are filled in).
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

  const fixtureDir = resolve(outDir, "fixture");

  if (opts.cloneFixture) {
    console.log(`\nCloning ${owner}/${repoName} into ${fixtureDir}...`);
    execFileSync("git", ["clone", `https://github.com/${owner}/${repoName}.git`, fixtureDir], {
      stdio: "inherit",
    });
    console.log(`Checking out base commit ${pr.base.sha}...`);
    execFileSync("git", ["checkout", pr.base.sha], { cwd: fixtureDir, stdio: "inherit" });
  }

  const projectKind = opts.cloneFixture ? detectProjectKind(fixtureDir) : "unknown";
  const { success, test_command, testCommandHint } = projectTestDefaults(
    projectKind,
    opts.cloneFixture ?? false,
    fixtureDir,
  );

  const yamlDoc: Record<string, any> = {
    name: slug,
    description: pr.title,
    fixture: "./fixture",
    prompt: buildPrompt(pr),
    success,
    timeout_seconds: 600,
    tags: ["imported", repoName],
    created_at: pr.created_at,
    test_command,
    fail_to_pass: [],
    pass_to_pass: [],
  };

  if (solutionDiff.trim()) yamlDoc.solution = "./solution.patch";
  if (testDiff.trim()) yamlDoc.test_patch = "./test_patch.patch";
  if (expectedFiles.length > 0) yamlDoc.expected_files = expectedFiles;
  if (forbidModified.length > 0) yamlDoc.forbid_modified = forbidModified;

  writeFileSync(resolve(outDir, "agr.yaml"), buildAgrYaml(yamlDoc, testCommandHint));

  console.log(`\nImported PR #${pr.number}: "${pr.title}"`);
  console.log(`Wrote scaffold to: ${outDir}`);
  console.log("  - agr.yaml");
  if (solutionDiff.trim())
    console.log(`  - solution.patch (${expectedFiles.length} file(s) changed)`);
  if (testDiff.trim())
    console.log(`  - test_patch.patch (${forbidModified.length} test file(s) changed)`);

  console.log("\nNext steps:");
  if (!opts.cloneFixture) {
    console.log(`  1. Check out ${owner}/${repoName}@${pr.base.sha} into ${outDir}/fixture`);
    console.log("  2. Fill in test_command, fail_to_pass, and pass_to_pass in agr.yaml");
    console.log(
      `  3. Run "agr validate ${resolve(outDir, "agr.yaml")}" to verify the test case`,
    );
    console.log(
      "\nNote: test_command/success defaults were NOT auto-detected because --clone-fixture was not set. Re-run with --clone-fixture to get language-specific defaults, or fill these fields manually.",
    );
  } else {
    console.log("  1. Fill in fail_to_pass and pass_to_pass in agr.yaml");
    console.log(
      `  2. Run "agr validate ${resolve(outDir, "agr.yaml")}" to verify the test case`,
    );
  }

  if (opts.validate) {
    console.log("\nRunning validation...\n");
    await validateCommand(resolve(outDir, "agr.yaml"));
  }
}

function detectProjectKind(fixtureDir: string): ProjectKind {
  if (
    existsSync(resolve(fixtureDir, "pyproject.toml")) ||
    existsSync(resolve(fixtureDir, "setup.py")) ||
    readdirSync(fixtureDir).some((name) => /^requirements.*\.txt$/i.test(name))
  ) {
    return "python";
  }
  if (existsSync(resolve(fixtureDir, "package.json"))) return "node";
  if (existsSync(resolve(fixtureDir, "go.mod"))) return "go";
  return "unknown";
}

/**
 * TODO: fail_to_pass/pass_to_pass auto-discovery (pytest-TAP name extraction) is not
 * implemented yet. Fill those lists manually after running the test suite.
 */
function projectTestDefaults(
  kind: ProjectKind,
  cloned: boolean,
  fixtureDir: string,
): {
  success: Array<{ run: string; expect: { exit_code: number } }>;
  test_command: string;
  testCommandHint: TestCommandHint;
} {
  if (!cloned) {
    return {
      success: [
        { run: "<TODO: install dependencies and run the test suite>", expect: { exit_code: 0 } },
      ],
      test_command: "<TODO: shell command that runs tests with TAP output>",
      testCommandHint: "none",
    };
  }

  switch (kind) {
    case "python":
      return {
        success: [{ run: "pip install -e . && pytest", expect: { exit_code: 0 } }],
        test_command: "pytest --tap-stream",
        testCommandHint: "python",
      };
    case "node":
      return detectNodeTestRunner(fixtureDir);
    case "go":
      return {
        success: [{ run: "go test ./...", expect: { exit_code: 0 } }],
        test_command: "<TODO: configure a TAP-producing test command for go>",
        testCommandHint: "go",
      };
    default:
      return {
        success: [
          { run: "<TODO: install dependencies and run the test suite>", expect: { exit_code: 0 } },
        ],
        test_command: "<TODO: shell command that runs tests with TAP output>",
        testCommandHint: "none",
      };
  }
}

function detectNodeTestRunner(fixtureDir: string): {
  success: Array<{ run: string; expect: { exit_code: number } }>;
  test_command: string;
  testCommandHint: TestCommandHint;
} {
  const success = [{ run: "npm install && npm test", expect: { exit_code: 0 } }];
  const fallback = {
    success,
    test_command: "tsx --test --test-reporter=tap src/**/*.test.ts",
    testCommandHint: "node-unknown" as const,
  };

  try {
    const pkgPath = resolve(fixtureDir, "package.json");
    if (!existsSync(pkgPath)) return fallback;

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.ava) {
      return { success, test_command: "npx ava --tap", testCommandHint: "ava" };
    }
    if (deps.vitest) {
      return { success, test_command: "npx vitest run --reporter=tap", testCommandHint: "vitest" };
    }
    if (deps.jest) {
      return { success, test_command: "npx jest --ci", testCommandHint: "jest" };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function buildAgrYaml(doc: Record<string, any>, testCommandHint: TestCommandHint): string {
  let yaml = stringify(doc);
  const testListComment =
    "# TODO: run the test suite (see test_command above) and add real test names here.\n# agr validate checks pre/post-patch status once these fields are filled in.";
  yaml = yaml.replace(/^fail_to_pass:/m, `${testListComment}\nfail_to_pass:`);

  const testCommandComments: Partial<Record<TestCommandHint, string>> = {
    python: "# Requires pytest-tap for TAP output (pip install pytest-tap).",
    jest: "# jest does not output TAP by default; consider jest-tap-reporter",
    "node-unknown":
      "# test_command could not be auto-detected reliably - verify this matches the project's actual test setup",
  };

  const comment = testCommandComments[testCommandHint];
  if (comment) {
    yaml = yaml.replace(/^test_command: (.+)$/m, `${comment}\n$&`);
  }

  return yaml;
}

function buildPrompt(pr: PullRequestInfo): string {
  const body = (pr.body || "").trim();
  return body ? `${pr.title}\n\n${body}` : pr.title;
}

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
