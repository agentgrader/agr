import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { printInitOutput } from "../lib/init-output";

const ENV_EXAMPLE = `# Copy to .env and fill in your key:
# cp .env.example .env
ANTHROPIC_API_KEY=
`;

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

      - name: Run eval bench
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: agr bench --suite tasks/ --ci

      - name: Bench summary
        if: always()
        run: agr status --summary --github-step-summary
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

export async function initCommand(dir: string | undefined, opts: { force?: boolean; blank?: boolean; ci?: boolean; example?: string; model?: string; provider?: string }) {
  const root = resolve(dir || ".");
  const agentConfigPath = resolve(root, "agent.yaml");

  if (existsSync(agentConfigPath) && !opts.force) {
    throw new Error(
      `${agentConfigPath} already exists. Re-run with --force to overwrite, or choose a different directory.`,
    );
  }

  let agentConfigYaml = AGENT_CONFIG_YAML;
  if (opts.model) {
    agentConfigYaml = agentConfigYaml.replace(/^model: .+$/m, `model: ${opts.model}`);
  }
  if (opts.provider) {
    agentConfigYaml = agentConfigYaml.replace(/^provider: .+$/m, `provider: ${opts.provider}`);
  }
  writeFileSync(agentConfigPath, agentConfigYaml);

  const envExamplePath = resolve(root, ".env.example");
  if (!existsSync(envExamplePath)) {
    writeFileSync(envExamplePath, ENV_EXAMPLE);
  }

  const gitignorePath = resolve(root, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, GITIGNORE);
  }

  if (opts.blank) {
    mkdirSync(resolve(root, "tasks"), { recursive: true });
    if (opts.ci) writeCI(root);

    printInitOutput({ root, kind: "blank", ci: opts.ci });
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

  if (opts.ci) writeCI(root);

  printInitOutput({
    root,
    kind: isPython ? "python" : "default",
    taskName,
    ci: opts.ci,
  });
}
