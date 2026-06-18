import { loadProjectEnv } from "./lib/load-env";

loadProjectEnv();

import { cac } from "cac";
import { cleanupCommand } from "./commands/cleanup";
import { compareCommand } from "./commands/compare";
import { compareBaselineCommand } from "./commands/compare-baseline";
import { doctorCommand } from "./commands/doctor";
import { exportCommand } from "./commands/export";
import { runBenchCommand } from "./commands/bench";
import { importPrCommand } from "./commands/import-pr";
import { initCommand } from "./commands/init";
import { listCommand } from "./commands/list";
import { listTestsCommand } from "./commands/list-tests";
import { runSingleCommand } from "./commands/run";
import { toolkitAddCommand, toolkitListCommand } from "./commands/toolkit";
import { traceCommand } from "./commands/trace";
import { validateCommand } from "./commands/validate";
import { validateToolkitCommand } from "./commands/validate-toolkit";
import { statusCommand } from "./commands/status";

const cli = cac("agr");

cli
  .command("init [dir]", "Scaffold a minimal, runnable agentgrader project (agent config + sample test case)")
  .option("--force", "Overwrite agent.yaml if it already exists")
  .option("--blank", "Only write agent.yaml and an empty tasks/ dir, without the hello-world sample test case")
  .option("--ci", "Also write a GitHub Actions workflow (.github/workflows/agr.yml) that runs agr bench on push and pull_request")
  .option("--example <lang>", "Sample test case language: js (default) or python/py (pytest-based hello-world)")
  .example("agr init")
  .example("agr init my-project")
  .example("agr init --blank")
  .example("agr init --ci")
  .example("agr init --blank --ci")
  .example("agr init --example python")
  .action(async (dir, options) => {
    try {
      await initCommand(dir, options);
    } catch (err: any) {
      console.error(`Error executing init: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("list-tests [dir]", "List test cases (agr.yaml files) found under dir (default: cwd)")
  .option("--json", "Print results as a JSON array instead of a human-readable table")
  .option("--count", "Print only the number of matching test cases (useful for scripting)")
  .option("--tags <tags>", "Comma-separated list of tags; only show test cases with at least one matching tag")
  .option("--name <substring>", "Filter by test case name substring (case-insensitive)")
  .example("agr list-tests")
  .example("agr list-tests tasks/")
  .example("agr list-tests --json")
  .example("agr list-tests --count")
  .example("agr list-tests --tags python,fast")
  .example("agr list-tests --name fix")
  .action(async (dir, options) => {
    try {
      const tags = options.tags ? (options.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) : undefined;
      await listTestsCommand(dir, { json: options.json, count: options.count, tags, name: options.name });
    } catch (err: any) {
      console.error(`Error executing list-tests: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command(
    "run <testCase>",
    "Run a single agent test case (path to agr.yaml, a directory containing one, or a test case name from `agr list-tests`)",
  )
  .option("--config <config>", "Path to an AgentConfig YAML file")
  .option("--model <model>", "Override the model from the agent config for this run (e.g. claude-opus-4-8)")
  .option("--max-steps <n>", "Override the max_steps from the agent config for this run")
  .option("--adapter <adapter>", "Agent adapter to use (ai-sdk, acp)", { default: "ai-sdk" })
  .option(
    "--verbose",
    "Stream agent steps live to the console as they happen",
  )
  .option("--fail-on-failure", "Exit with code 1 if the run does not pass")
  .option("--repeat <n>", "Run the test case N times and print a solve-rate summary (useful for flakiness testing)")
  .option("--report <format>", "Write a report (json, jsonl, html, md)")
  .option("--output <path>", "Output path for --report")
  .option("--report-include-traces", "Include full step traces in --report output")
  .option("--sandbox <provider>", "Sandbox provider (docker, e2b)", { default: "docker" })
  .option("--llm-judge", "Run LlmJudgeScorer after the agent completes")
  .option("--llm-judge-provider <provider>", "LLM judge provider (anthropic, openai)", { default: "anthropic" })
  .option("--llm-judge-model <model>", "LLM judge model slug")
  .option("--judge-gate", "Fail the run when the LLM judge score is below --judge-min-score")
  .option("--judge-min-score <score>", "Minimum LLM judge score when --judge-gate is set", { default: 0.7 })
  .option("--step-timeout <ms>", "Override step_timeout_ms for this run (ms per LLM provider call before abort)")
  .option("--save-baseline <path>", "Write a baseline snapshot JSON after the run completes")
  .option("--json", "Output run result as a single JSON object (suppresses the live UI; useful for scripting and CI)")
  .example("agr run hello-world")
  .example("agr run hello-world --config agent.yaml --verbose")
  .example("agr run hello-world --model claude-opus-4-8")
  .example("agr run hello-world --repeat 5")
  .example("agr run tasks/fix-bug/agr.yaml --fail-on-failure")
  .example("agr run hello-world --save-baseline baselines/main.json")
  .example("agr run hello-world --json")
  .action(async (testCase, options) => {
    try {
      await runSingleCommand(testCase, { ...options, json: options.json, repeat: options.repeat !== undefined ? Number(options.repeat) : undefined, maxSteps: options.maxSteps !== undefined ? Number(options.maxSteps) : undefined, stepTimeout: options.stepTimeout !== undefined ? Number(options.stepTimeout) : undefined, saveBaseline: options.saveBaseline });
    } catch (err: any) {
      console.error(`Error executing run: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("bench [...testCases]", "Compare and optimize across multiple test cases and agent configs")
  .option("--configs <configs>", "Comma-separated paths to AgentConfig YAML files")
  .option("--config <config>", "Alias for --configs (single config path)")
  .option(
    "--configs-dir <dir>",
    "Directory of AgentConfig YAML files (all .yaml/.yml files in the folder)",
  )
  .option(
    "--manifest <manifest>",
    "Path to a bench manifest YAML (suite + agent paths/glob in one file)",
  )
  .option("--suite <suite>", "Path to test suite directory containing test cases")
  .option("--adapters <adapters>", "Comma-separated agent adapters (ai-sdk, acp)", { default: "ai-sdk" })
  .option("--concurrency <concurrency>", "Number of parallel sandbox executions", { default: 2 })
  .option(
    "--matrix <matrix>",
    "Path to an optimizer matrix YAML file - expands into agent configs and prints a Pareto summary afterwards (alternative to --configs)",
  )
  .option("--fail-on-failure", "Exit with code 1 if any run in the comparison sweep fails")
  .option("--min-solve-rate <rate>", "Exit with code 1 if solve rate is below this threshold (0-1)")
  .option(
    "--min-solve-rate-scope <scope>",
    "Apply --min-solve-rate globally or per agent config (global, per-config)",
    { default: "global" },
  )
  .option("--report <format>", "Write a report after the bench (json, jsonl, html, md)")
  .option("--output <path>", "Output path for --report")
  .option("--report-include-traces", "Include full step traces in --report output")
  .option("--save-baseline <path>", "Write a baseline snapshot JSON after the bench completes")
  .option("--sandbox <provider>", "Sandbox provider (docker, e2b)", { default: "docker" })
  .option("--strict-toolkits", "Exit with code 1 if any referenced toolkit fails security audit")
  .option("--llm-judge", "Run LlmJudgeScorer on each completed run")
  .option("--llm-judge-provider <provider>", "LLM judge provider (anthropic, openai)", { default: "anthropic" })
  .option("--llm-judge-model <model>", "LLM judge model slug")
  .option("--judge-gate", "Fail runs when the LLM judge score is below --judge-min-score")
  .option("--judge-min-score <score>", "Minimum LLM judge score when --judge-gate is set", { default: 0.7 })
  .option("--dry-run", "Print the test case x config matrix without executing any runs")
  .option("--tags <tags>", "Comma-separated list of tags; only test cases with at least one matching tag are run (requires --suite)")
  .option("--skip-tags <tags>", "Comma-separated list of tags; test cases with any of these tags are excluded (requires --suite; applied after --tags)")
  .option("--limit <n>", "Run only the first N test cases (useful for smoke tests on large suites)")
  .option("--only-failed", "Run only the test cases that failed on their most recent run in the DB")
  .option("--shuffle", "Randomize the order of test cases before running (reduces order-dependent bias in large suites)")
  .option("--model <model>", "Override the model for all agent configs in this bench run (e.g. claude-opus-4-8)")
  .option("--max-steps <n>", "Override the max_steps for all agent configs in this bench run")
  .option("--step-timeout <ms>", "Override step_timeout_ms for all agent configs in this bench run (ms per LLM provider call before abort)")
  .option("--name <substring>", "Filter test cases by name substring (case-insensitive); applied after --tags and --skip-tags. Requires --suite.")
  .option("--json", "Output bench results as a single JSON object and suppress the live dashboard; useful for scripting and CI pipelines")
  .example("agr bench hello-world")
  .example("agr bench hello-world --matrix matrix.yaml")
  .example("agr bench task-a task-b --configs agent.yaml")
  .example("agr bench --manifest bench.yaml")
  .example("agr bench --suite tasks --configs-dir ./agents")
  .example("agr bench --suite tasks --configs agent.yaml,agent-openrouter.yaml")
  .example("agr bench --suite tasks --matrix optimizer-matrix.yaml")
  .action(async (testCases, options) => {
    if (!options.configs && options.config) {
      options.configs = options.config;
    }

    const hasPositional = testCases && testCases.length > 0;

    const agentSourceCount = [
      options.configs,
      options.configsDir,
      options.matrix,
      options.manifest,
    ].filter(Boolean).length;

    if (options.manifest) {
      if (agentSourceCount > 1) {
        console.error(
          "Error: --manifest cannot be combined with --configs, --configs-dir, or --matrix.",
        );
        process.exit(1);
      }
    } else if (!options.suite && !hasPositional) {
      console.error(
        "Error: provide --manifest, test case names as arguments, or --suite with one of --configs, --config, --configs-dir, --matrix, or a shared agent_config in every agr.yaml.",
      );
      process.exit(1);
    } else if (agentSourceCount > 1) {
      console.error(
        "Error: use only one agent source: --configs, --configs-dir, or --matrix.",
      );
      process.exit(1);
    }

    try {
      await runBenchCommand({
        configs: options.configs,
        configsDir: options.configsDir,
        suite: options.suite,
        concurrency: Number(options.concurrency),
        matrix: options.matrix,
        manifest: options.manifest,
        adapters: options.adapters,
        failOnFailure: options.failOnFailure,
        minSolveRate: options.minSolveRate !== undefined ? Number(options.minSolveRate) : undefined,
        minSolveRateScope: options.minSolveRateScope,
        report: options.report,
        output: options.output,
        reportIncludeTraces: options.reportIncludeTraces,
        saveBaseline: options.saveBaseline,
        sandbox: options.sandbox,
        strictToolkits: options.strictToolkits,
        llmJudge: options.llmJudge,
        llmJudgeProvider: options.llmJudgeProvider,
        llmJudgeModel: options.llmJudgeModel,
        judgeGate: options.judgeGate,
        judgeMinScore: options.judgeMinScore !== undefined ? Number(options.judgeMinScore) : undefined,
        testCaseArgs: hasPositional ? testCases : undefined,
        dryRun: options.dryRun,
        tags: options.tags ? (options.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) : undefined,
        skipTags: options.skipTags ? (options.skipTags as string).split(",").map((t: string) => t.trim()).filter(Boolean) : undefined,
        limit: options.limit !== undefined ? Number(options.limit) : undefined,
        onlyFailed: options.onlyFailed,
        shuffle: options.shuffle,
        model: options.model,
        maxSteps: options.maxSteps !== undefined ? Number(options.maxSteps) : undefined,
        stepTimeout: options.stepTimeout !== undefined ? Number(options.stepTimeout) : undefined,
        name: options.name,
        json: options.json,
      });
    } catch (err: any) {
      console.error(`Error executing comparison sweep: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command(
    "validate [...testCases]",
    "Validate one or more test case definitions (fixture, fail_to_pass/pass_to_pass, gold patch)",
  )
  .option(
    "--strict",
    "Exit with code 1 if test_command or fail_to_pass/pass_to_pass are missing",
  )
  .option("--sandbox <provider>", "Sandbox provider (docker, e2b)", { default: "docker" })
  .option("--audit-toolkits", "Run security audit on toolkits referenced by the test case")
  .option("--suite <dir>", "Validate every test case found under this directory")
  .option("--tags <tags>", "Comma-separated list of tags; only validate matching test cases (requires --suite)")
  .option("--name <substring>", "Filter test cases by name substring (case-insensitive); requires --suite")
  .option("--json", "Output validation results as a single JSON object; suppresses per-check console output")
  .example("agr validate fix-greeting")
  .example("agr validate fix-greeting --strict")
  .example("agr validate task-a task-b task-c --strict")
  .example("agr validate --suite tasks/ --strict")
  .example("agr validate --suite tasks/ --tags python --strict")
  .example("agr validate --suite tasks/ --name fix --strict")
  .example("agr validate fix-greeting --json")
  .action(async (testCases, options) => {
    try {
      if ((!testCases || testCases.length === 0) && !options.suite) {
        console.error("No test case specified. Usage: agr validate <testCase> [testCase...] or --suite <dir>");
        process.exit(1);
      }
      const tags = options.tags ? (options.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) : undefined;
      await validateCommand(testCases ?? [], { ...options, suite: options.suite, tags, json: options.json, name: options.name });
    } catch (err: any) {
      console.error(`Error executing validate: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command(
    "import-pr <repo> <prNumber>",
    "Scaffold a test case from a GitHub pull request (e.g. owner/repo 1234)",
  )
  .option("--out <dir>", "Output directory for the scaffolded test case")
  .option(
    "--clone-fixture",
    "Clone the repo and check out the PR's base commit into ./fixture (required for language/test-command auto-detection)",
  )
  .option("--validate", "Run `agr validate` against the scaffolded test case afterwards")
  .example("agr import-pr astropy/astropy 12907 --clone-fixture --validate")
  .action(async (repo, prNumber, options) => {
    try {
      await importPrCommand(repo, prNumber, options);
    } catch (err: any) {
      console.error(`Error executing import-pr: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("status", "Show a quick summary of the local run database (.agr/db.sqlite)")
  .option("--db <path>", "Path to the SQLite database", { default: ".agr/db.sqlite" })
  .option("--json", "Output as JSON (for scripts and CI)")
  .option("--since <duration|date>", "Restrict stats to runs after this point (e.g. 1h, 24h, 7d, or ISO date)")
  .option("--test-case <name>", "Restrict stats to runs for this specific test case (substring match)")
  .option("--config <name>", "Restrict stats to runs for this specific agent config (substring match)")
  .option("--passed", "Restrict stats to runs that passed")
  .option("--failed", "Restrict stats to runs that failed")
  .option("--by-config", "Show a per-config breakdown (solve rate, avg cost, avg duration), sorted by solve rate")
  .option("--by-test-case", "Show a per-test-case breakdown (solve rate, avg cost, avg duration), sorted by solve rate ascending (hardest first)")
  .option("--top <n>", "With --by-config or --by-test-case, show only the top N entries")
  .example("agr status")
  .example("agr status --json")
  .example("agr status --since 24h")
  .example("agr status --test-case hello-world")
  .example("agr status --config agent-fast")
  .example("agr status --failed")
  .example("agr status --by-config")
  .example("agr status --by-config --test-case hello-world")
  .example("agr status --by-test-case")
  .action(async (options) => {
    try {
      if (options.passed && options.failed) {
        console.error("Error: --passed and --failed are mutually exclusive.");
        process.exit(1);
      }
      const passed = options.passed ? true : options.failed ? false : undefined;
      await statusCommand({ db: options.db, json: options.json, since: options.since, testCase: options.testCase, config: options.config, passed, byConfig: options.byConfig, byTestCase: options.byTestCase, top: options.top !== undefined ? Number(options.top) : undefined });
    } catch (err: any) {
      console.error(`Error executing status: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("list", "Browse saved runs from .agr/db.sqlite interactively")
  .option("--db <path>", "Path to the SQLite database", { default: ".agr/db.sqlite" })
  .option("--limit <n>", "Maximum number of runs to load", { default: 100 })
  .option("--plain", "Print a plain text list instead of the interactive UI")
  .option("--since <duration|date>", "Only show runs after this point (e.g. 1h, 24h, 7d, or ISO date)")
  .option("--test-case <name>", "Only show runs for this specific test case (substring match)")
  .option("--config <name>", "Only show runs for this specific agent config (substring match)")
  .option("--passed", "Only show runs that passed")
  .option("--failed", "Only show runs that failed")
  .example("agr list")
  .example("agr list --limit 20")
  .example("agr list --plain")
  .example("agr list --plain --since 24h")
  .example("agr list --plain --test-case hello-world")
  .example("agr list --plain --config agent-fast")
  .example("agr list --plain --failed")
  .action(async (options) => {
    try {
      if (options.passed && options.failed) {
        console.error("Error: --passed and --failed are mutually exclusive.");
        process.exit(1);
      }
      const passed = options.passed ? true : options.failed ? false : undefined;
      await listCommand({
        db: options.db,
        limit: Number(options.limit),
        plain: options.plain,
        since: options.since,
        testCase: options.testCase,
        config: options.config,
        passed,
      });
    } catch (err: any) {
      console.error(`Error executing list: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("trace [runId]", "Show the step trace and metrics for a single run")
  .option(
    "--quality",
    "Show only the quality-metrics breakdown (static-quality, llm-judge, diff, localization)",
  )
  .option(
    "--tools",
    "Show only a tool-usage breakdown (call count per tool name) instead of the full trace",
  )
  .option("--last", "Trace the most recent run in .agr/db.sqlite (no runId needed)")
  .option("--test-case <name>", "With --last, trace the most recent run for this specific test case (substring match)")
  .option("--config <name>", "With --last, trace the most recent run for this specific agent config (substring match)")
  .example("agr trace <runId>")
  .example("agr trace <runId> --tools")
  .example("agr trace --last")
  .example("agr trace --last --quality")
  .example("agr trace --last --test-case hello-world")
  .example("agr trace --last --config agent-a")
  .action(async (runId, options) => {
    try {
      if (!runId && !options.last) {
        console.error("Provide a run ID or use --last to trace the most recent run.");
        process.exit(1);
      }
      await traceCommand(runId, { ...options, testCase: options.testCase, config: options.config });
    } catch (err: any) {
      console.error(`Error executing trace: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("export <subcommand>", "Export runs or traces (runs, traces)")
  .option("--format <format>", "Export format (json, jsonl, otlp, csv)", { default: "json" })
  .option("--output <path>", "Output file path")
  .option("--db <path>", "SQLite database path", { default: ".agr/db.sqlite" })
  .option("--run-id <id>", "Run id for trace export")
  .option("--last", "Export traces for the most recent run (no --run-id needed)")
  .option("--matrix-id <id>", "Filter runs by matrix id")
  .option("--last-matrix", "Export runs for the most recent matrix sweep (no --matrix-id needed)")
  .option("--limit <n>", "Maximum number of runs to export")
  .option("--since <duration|date>", "Only export runs after this point (e.g. 1h, 24h, 7d, or ISO date)")
  .option("--test-case <id>", "Filter exported runs/traces to those with a matching testCaseId (substring match)")
  .option("--config <id>", "Filter exported runs/traces to those with a matching agentConfigId (substring match)")
  .option("--passed", "Export only runs/traces that passed")
  .option("--failed", "Export only runs/traces that failed")
  .example("agr export runs --format jsonl --output runs.jsonl")
  .example("agr export runs --format csv --output runs.csv")
  .example("agr export runs --since 24h --format jsonl --output today.jsonl")
  .example("agr export runs --last-matrix --format jsonl --output sweep.jsonl")
  .example("agr export runs --test-case hello-world --format jsonl --output hello.jsonl")
  .example("agr export runs --failed --output failed-runs.json")
  .example("agr export traces --run-id <runId> --format otlp --output trace.json")
  .example("agr export traces --last --format otlp --output last-trace.json")
  .example("agr export traces --test-case hello-world --format jsonl --output hello-traces.jsonl")
  .example("agr export traces --last --test-case hello-world --format otlp --output last-hello.json")
  .action(async (subcommand, options) => {
    try {
      if (options.passed && options.failed) {
        console.error("Error: --passed and --failed are mutually exclusive.");
        process.exit(1);
      }
      const passedFilter = options.passed ? true : options.failed ? false : undefined;
      await exportCommand(subcommand, {
        format: options.format,
        output: options.output,
        db: options.db,
        runId: options.runId,
        last: options.last,
        matrixId: options.matrixId,
        lastMatrix: options.lastMatrix,
        limit: options.limit ? Number(options.limit) : undefined,
        since: options.since,
        testCase: options.testCase,
        config: options.config,
        passed: passedFilter,
      });
    } catch (err: any) {
      console.error(`Error executing export: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("validate-toolkit <dir>", "Run security audit on a toolkit directory")
  .option("--strict", "Exit with code 1 on warnings as well as errors")
  .example("agr validate-toolkit ./toolkits/jetbrains-tools")
  .action(async (dir, options) => {
    try {
      await validateToolkitCommand(dir, options);
    } catch (err: any) {
      console.error(`Error executing validate-toolkit: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("compare-baseline [snapshotA] [snapshotB]", "Compare two baseline snapshots or current DB runs vs a snapshot")
  .option("--current <path>", "Compare the most recent runs in .agr/db.sqlite against this baseline snapshot")
  .option("--format <format>", "Output format (md, json)", { default: "md" })
  .option("--output <path>", "Write comparison to a file instead of stdout")
  .option("--db <path>", "Path to SQLite database for --current", { default: ".agr/db.sqlite" })
  .option("--fail-on-regression", "Exit with code 1 if solve rate dropped or any case regressed")
  .example("agr compare-baseline baselines/main.json baselines/pr.json")
  .example("agr compare-baseline --current baselines/main.json --format md --output comment.md")
  .action(async (snapshotA, snapshotB, options) => {
    try {
      await compareBaselineCommand({
        snapshotA,
        snapshotB,
        current: options.current,
        format: options.format,
        output: options.output,
        db: options.db,
        failOnRegression: options.failOnRegression,
      });
    } catch (err: any) {
      console.error(`Error executing compare-baseline: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("compare [runIdA] [runIdB]", "Compare the step traces of two runs side by side")
  .option("--full", "Print full step content without truncation")
  .option(
    "--only-diff",
    "Show only divergent steps plus one step of context before and after each",
  )
  .option("--last-two", "Compare the two most recent runs (no run IDs needed)")
  .option("--test-case <name>", "With --last-two, compare the two most recent runs for this specific test case")
  .option("--config <name>", "With --last-two, compare the two most recent runs for this specific agent config (substring match)")
  .example("agr compare <runIdA> <runIdB> --only-diff")
  .example("agr compare --last-two --only-diff")
  .example("agr compare --last-two --test-case hello-world")
  .example("agr compare --last-two --config agent-a")
  .action(async (runIdA, runIdB, options) => {
    try {
      await compareCommand(runIdA, runIdB, { ...options, lastTwo: options.lastTwo, testCase: options.testCase, config: options.config });
    } catch (err: any) {
      console.error(`Error executing compare: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("cleanup", "List (or remove) leftover sandbox containers from killed/hung runs")
  .option("--yes", "Actually remove the listed containers (default: list only)")
  .example("agr cleanup")
  .example("agr cleanup --yes")
  .action(async (options) => {
    try {
      await cleanupCommand(options);
    } catch (err: any) {
      console.error(`Error executing cleanup: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("toolkit-add <name>", "Scaffold a new toolkit tool (bin/<name> script + .claude/skills/<name>/SKILL.md)")
  .option("--dir <dir>", "Toolkit directory to scaffold into", { default: "./toolkit" })
  .example("agr toolkit-add find-usages")
  .example("agr toolkit-add run-tests --dir ./toolkits/jetbrains-tools")
  .action(async (name, options) => {
    try {
      await toolkitAddCommand(name, options);
    } catch (err: any) {
      console.error(`Error executing toolkit-add: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("toolkit-list <dir>", "List a toolkit's bin/ tools and their SKILL.md descriptions")
  .option("--check-config <file>", "Diff the toolkit's bin/ tools against an agent config's track_tools")
  .example("agr toolkit-list ./toolkits/jetbrains-tools")
  .example("agr toolkit-list ./toolkits/jetbrains-tools --check-config matrix-jetbrains-toolkits.yaml")
  .action(async (dir, options) => {
    try {
      await toolkitListCommand(dir, options);
    } catch (err: any) {
      console.error(`Error executing toolkit-list: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("doctor", "Check that the local environment is set up correctly for Agentgrader")
  .option("--db <path>", "Path to the SQLite database to check", { default: ".agr/db.sqlite" })
  .option("--suite <dir>", "Test suite directory to check for agr.yaml files", { default: "tasks" })
  .option("--json", "Output check results as a JSON object and suppress human-readable output")
  .example("agr doctor")
  .example("agr doctor --suite my-tasks/")
  .example("agr doctor --json")
  .action(async (options) => {
    try {
      await doctorCommand({ db: options.db, suite: options.suite, json: options.json });
    } catch (err: any) {
      console.error(`Error executing doctor: ${err.message}`);
      process.exit(1);
    }
  });

cli.help();

try {
  cli.parse();
} catch (err: any) {
  if (err.name === "CACError") {
    console.error(`\n[error] ${err.message}\n`);
    cli.outputHelp();
    process.exit(1);
  }
  throw err;
}
