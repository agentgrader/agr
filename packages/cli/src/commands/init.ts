import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const GITIGNORE = `# Agentgrader run history and exports
.agr/

# Environment variables
.env
`;

const AGENT_CONFIG_YAML = `name: Baseline Agent
model: claude-haiku-4-5-20251001
provider: anthropic
max_steps: 15
temperature: 0.2
system_prompt: |
  You are a professional software developer. Your goal is to solve the coding task inside the sandbox.
  Use the executeCommand tool to run tests and verify your code changes.
  Use readFile and writeFile to read and edit code files.
  Call submit when you are confident all requirements are implemented and tests pass.
`;

const TEST_CASE_YAML = `name: hello-world
description: implement add() so the test suite passes
fixture: ./fixture
prompt: |
  The function add(a, b) in math.js is not implemented (it currently returns
  undefined). Implement it so it returns the sum of a and b. Do not change
  its signature or the test file.
success:
  - run: node --test math.test.js
    expect: { exit_code: 0 }
timeout_seconds: 120

agent_config: ../../agent.yaml
`;

const FIXTURE_MATH_JS = `function add(a, b) {
  // TODO: implement this so it returns the sum of a and b
}

module.exports = { add };
`;

const FIXTURE_MATH_TEST_JS = `const test = require("node:test");
const assert = require("node:assert");
const { add } = require("./math");

test("add() returns the sum of its two arguments", () => {
  assert.strictEqual(add(2, 3), 5);
  assert.strictEqual(add(-1, 1), 0);
  assert.strictEqual(add(0, 0), 0);
});
`;

const TEST_CASE_PYTHON_YAML = `name: hello-world-python
description: implement add() so the pytest suite passes
fixture: ./fixture
prompt: |
  The function add(a, b) in math.py is not implemented (it currently raises
  NotImplementedError). Implement it so it returns the sum of a and b. Do not
  change its signature or the test file.
success:
  - run: pytest -x test_math.py
    expect: { exit_code: 0 }
timeout_seconds: 120

agent_config: ../../agent.yaml
`;

const FIXTURE_MATH_PY = `def add(a: int, b: int) -> int:
    # TODO: implement this so it returns the sum of a and b
    raise NotImplementedError
`;

const FIXTURE_TEST_MATH_PY = `import pytest
from math import add


def test_add_positives():
    assert add(2, 3) == 5


def test_add_negative():
    assert add(-1, 1) == 0


def test_add_zeros():
    assert add(0, 0) == 0
`;

const CI_WORKFLOW_YAML = `name: agentgrader

on:
  push:
    branches: [main]
  pull_request:

jobs:
  bench:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install agentgrader
        run: npm install -g agentgrader

      - name: Run comparison sweep
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: agr bench --suite tasks/ --fail-on-failure
`;

/**
 * `agr init [dir] [--force]`
 *
 * Scaffolds a minimal, runnable boilerplate project in `dir` (default `.`)
 * so a new user can immediately try `agr run` without writing any YAML by
 * hand:
 *
 *  - `<dir>/agent.yaml`: a baseline agent config (claude-haiku-4-5,
 *    provider: anthropic, max_steps: 15).
 *  - `<dir>/tasks/hello-world/agr.yaml` + `fixture/`: a tiny, self-contained
 *    test case (implement `add(a, b)` in `math.js` so `node --test
 *    math.test.js` passes). Uses Node's built-in test runner, so no
 *    `npm install`/`pip install` is needed inside the sandbox.
 *
 * Mirrors `git init`: refuses to overwrite an existing `<dir>/agent.yaml`
 * unless `--force` is passed.
 */
function writeCI(root: string): string {
  const ciPath = resolve(root, ".github/workflows/agr.yml");
  if (!existsSync(ciPath)) {
    mkdirSync(dirname(ciPath), { recursive: true });
    writeFileSync(ciPath, CI_WORKFLOW_YAML);
  }
  return ciPath;
}

export async function initCommand(dir: string | undefined, opts: { force?: boolean; blank?: boolean; ci?: boolean; example?: string }) {
  const root = resolve(dir || ".");
  const agentConfigPath = resolve(root, "agent.yaml");

  if (existsSync(agentConfigPath) && !opts.force) {
    throw new Error(
      `${agentConfigPath} already exists. Re-run with --force to overwrite, or choose a different directory.`,
    );
  }

  writeFileSync(agentConfigPath, AGENT_CONFIG_YAML);

  const gitignorePath = resolve(root, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, GITIGNORE);
  }

  if (opts.blank) {
    mkdirSync(resolve(root, "tasks"), { recursive: true });

    console.log(`Scaffolded a blank agentgrader project in ${root}`);
    console.log("");
    console.log("Created:");
    console.log("  agent.yaml  - agent config (claude-haiku-4-5, provider: anthropic)");
    console.log("  .gitignore  - ignores .agr/ (run history) and .env");
    console.log("  tasks/      - put your own test cases here, e.g. tasks/<name>/agr.yaml");
    if (opts.ci) {
      writeCI(root);
      console.log("  .github/workflows/agr.yml  - GitHub Actions CI workflow (runs agr bench on push/PR)");
    }
    console.log("");
    console.log("Next steps:");
    console.log("  1. Make sure ANTHROPIC_API_KEY is set in your environment.");
    console.log("  2. Add a test case under tasks/<name>/agr.yaml (see");
    console.log("     https://agentgrader.dev/guide/concepts for the schema).");
    console.log("     Tip: include `agent_config: ../../agent.yaml` in each agr.yaml so");
    console.log("     `agr run <name>` works without --config, or always pass --config agent.yaml.");
    console.log("  3. Run `agr list-tests` to confirm it's found, then `agr run <name>`.");
    console.log("  4. Check your DB summary any time with `agr status`.");
    if (opts.ci) {
      console.log("  5. Add ANTHROPIC_API_KEY as a GitHub Actions secret to enable CI:");
      console.log("     https://docs.github.com/en/actions/security-for-github-actions/using-secrets-in-github-actions");
    }
    return;
  }

  const isPython = opts.example === "python" || opts.example === "py";

  const taskName = isPython ? "hello-world-python" : "hello-world";
  const taskDir = resolve(root, `tasks/${taskName}`);
  const fixtureDir = resolve(taskDir, "fixture");

  mkdirSync(fixtureDir, { recursive: true });

  if (isPython) {
    writeFileSync(resolve(taskDir, "agr.yaml"), TEST_CASE_PYTHON_YAML);
    writeFileSync(resolve(fixtureDir, "math.py"), FIXTURE_MATH_PY);
    writeFileSync(resolve(fixtureDir, "test_math.py"), FIXTURE_TEST_MATH_PY);
  } else {
    writeFileSync(resolve(taskDir, "agr.yaml"), TEST_CASE_YAML);
    writeFileSync(resolve(fixtureDir, "math.js"), FIXTURE_MATH_JS);
    writeFileSync(resolve(fixtureDir, "math.test.js"), FIXTURE_MATH_TEST_JS);
  }

  console.log(`Scaffolded a new agentgrader project in ${root}`);
  console.log("");
  console.log("Created:");
  console.log("  agent.yaml                         - agent config (claude-haiku-4-5, provider: anthropic)");
  console.log("  .gitignore                         - ignores .agr/ (run history) and .env");
  if (isPython) {
    console.log(`  tasks/${taskName}/agr.yaml  - a tiny test case (implement add() in math.py, verified with pytest)`);
    console.log(`  tasks/${taskName}/fixture/  - starter project for the test case`);
  } else {
    console.log("  tasks/hello-world/agr.yaml          - a tiny test case (implement add() in math.js)");
    console.log("  tasks/hello-world/fixture/          - starter project for the test case");
  }
  if (opts.ci) {
    writeCI(root);
    console.log("  .github/workflows/agr.yml          - GitHub Actions CI workflow (runs agr bench on push/PR)");
  }
  console.log("");
  if (isPython) {
    console.log("Note: the Python example requires pytest in the sandbox Docker image.");
    console.log("      If using the default image, add a requirements.txt with `pytest` or");
    console.log("      use a custom image with pytest pre-installed.");
    console.log("");
  }
  console.log("Next steps:");
  console.log("  1. Make sure ANTHROPIC_API_KEY is set in your environment.");
  console.log("  2. Try it out:");
  console.log("");
  console.log(`       agr run ${taskName} --verbose`);
  console.log("");
  console.log("  3. Inspect the trace afterwards with `agr trace --last` (or");
  console.log("     `agr trace <runId>` if you want to reference a specific run).");
  console.log("  4. Check your DB summary any time with `agr status`.");
  if (opts.ci) {
    console.log("  5. Add ANTHROPIC_API_KEY as a GitHub Actions secret to enable CI:");
    console.log("     https://docs.github.com/en/actions/security-for-github-actions/using-secrets-in-github-actions");
  }
}
