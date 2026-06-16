import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
export async function initCommand(dir: string | undefined, opts: { force?: boolean; blank?: boolean }) {
  const root = resolve(dir || ".");
  const agentConfigPath = resolve(root, "agent.yaml");

  if (existsSync(agentConfigPath) && !opts.force) {
    throw new Error(
      `${agentConfigPath} already exists. Re-run with --force to overwrite, or choose a different directory.`,
    );
  }

  writeFileSync(agentConfigPath, AGENT_CONFIG_YAML);

  if (opts.blank) {
    mkdirSync(resolve(root, "tasks"), { recursive: true });

    console.log(`Scaffolded a blank agentgrader project in ${root}`);
    console.log("");
    console.log("Created:");
    console.log("  agent.yaml  - agent config (claude-haiku-4-5, provider: anthropic)");
    console.log("  tasks/      - put your own test cases here, e.g. tasks/<name>/agr.yaml");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Make sure ANTHROPIC_API_KEY is set in your environment.");
    console.log("  2. Add a test case under tasks/<name>/agr.yaml (see");
    console.log("     https://agentgrader.dev/guide/concepts for the schema).");
    console.log("     Tip: include `agent_config: ../../agent.yaml` in each agr.yaml so");
    console.log("     `agr run <name>` works without --config, or always pass --config agent.yaml.");
    console.log("  3. Run `agr list-tests` to confirm it's found, then `agr run <name>`.");
    return;
  }

  const taskDir = resolve(root, "tasks/hello-world");
  const fixtureDir = resolve(taskDir, "fixture");

  mkdirSync(fixtureDir, { recursive: true });

  writeFileSync(resolve(taskDir, "agr.yaml"), TEST_CASE_YAML);
  writeFileSync(resolve(fixtureDir, "math.js"), FIXTURE_MATH_JS);
  writeFileSync(resolve(fixtureDir, "math.test.js"), FIXTURE_MATH_TEST_JS);

  console.log(`Scaffolded a new agentgrader project in ${root}`);
  console.log("");
  console.log("Created:");
  console.log("  agent.yaml                     - agent config (claude-haiku-4-5, provider: anthropic)");
  console.log("  tasks/hello-world/agr.yaml      - a tiny test case (implement add() in math.js)");
  console.log("  tasks/hello-world/fixture/      - starter project for the test case");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Make sure ANTHROPIC_API_KEY is set in your environment.");
  console.log("  2. Try it out:");
  console.log("");
  console.log("       agr run hello-world --verbose");
  console.log("");
  console.log("  3. Inspect the trace afterwards with `agr trace --last` (or");
  console.log("     `agr trace <runId>` if you want to reference a specific run).");
}
