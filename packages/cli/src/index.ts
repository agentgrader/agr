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
import { countCommand } from "./commands/count";
import { costCommand } from "./commands/cost";

const cli = cac("agr");

cli
  .command("init [dir]", "Scaffold a minimal, runnable agentgrader project (agent config + sample test case)")
  .option("--force", "Overwrite agent.yaml if it already exists")
  .option("--blank", "Only write agent.yaml and an empty tasks/ dir, without the hello-world sample test case")
  .option("--ci", "Also write a GitHub Actions workflow (.github/workflows/agr.yml) that runs agr bench on push and pull_request")
  .option("--example <lang>", "Sample test case language: js (default) or python/py (pytest-based hello-world)")
  .option("--model <model>", "Model to use in the scaffolded agent.yaml (default: claude-haiku-4-5-20251001)")
  .option("--provider <provider>", "Provider to use in the scaffolded agent.yaml (default: anthropic)")
  .example("agr init")
  .example("agr init my-project")
  .example("agr init --blank")
  .example("agr init --ci")
  .example("agr init --blank --ci")
  .example("agr init --example python")
  .example("agr init --model gpt-4o --provider openai")
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
  .option("--unrun", "Only show test cases with no recorded runs in .agr/db.sqlite; useful for finding tasks in the suite that have never been executed")
  .option("--run-counts", "Show run counts (total, passed, failed) alongside each test case, sorted by fewest runs first; useful for identifying under-covered test cases")
  .option("--db <path>", "Path to the SQLite database for --unrun and --run-counts (default: .agr/db.sqlite)")
  .example("agr list-tests")
  .example("agr list-tests tasks/")
  .example("agr list-tests --json")
  .example("agr list-tests --count")
  .example("agr list-tests --tags python,fast")
  .example("agr list-tests --name fix")
  .action(async (dir, options) => {
    try {
      const tags = options.tags ? (options.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) : undefined;
      await listTestsCommand(dir, { json: options.json, count: options.count, tags, name: options.name, unrun: options.unrun, runCounts: options.runCounts, db: options.db });
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
  .option("--provider <provider>", "Override the provider from the agent config for this run (e.g. anthropic, openai, openrouter)")
  .option("--temperature <n>", "Override the temperature from the agent config for this run (0.0–1.0)")
  .option("--max-steps <n>", "Override the max_steps from the agent config for this run")
  .option("--adapter <adapter>", "Agent adapter to use (ai-sdk, acp)", { default: "ai-sdk" })
  .option(
    "--verbose",
    "Stream agent steps live to the console as they happen",
  )
  .option("--fail-on-failure", "Exit with code 1 if the run does not pass")
  .option("--repeat <n>", "Run the test case N times and print a solve-rate summary (useful for flakiness testing)")
  .option("--min-pass-rate <rate>", "With --repeat: exit with code 1 if the solve rate (0-1) is below this threshold (e.g. 0.8 = 80%); more flexible than --fail-on-failure which fails on any single failure")
  .option("--until-pass", "Run the test case until it passes, up to --max-attempts (default 5); useful for checking if a flaky fix actually works")
  .option("--max-attempts <n>", "Maximum number of attempts for --until-pass (default: 5)")
  .option("--report <format>", "Write a report (json, jsonl, html, md)")
  .option("--output <path>", "Output path for --report")
  .option("--report-dir <dir>", "Directory for auto-named report files (e.g. reports/); generates run-<timestamp>.<ext> when --output is not given")
  .option("--report-include-traces", "Include full step traces in --report output")
  .option("--sandbox <provider>", "Sandbox provider (docker, e2b)", { default: "docker" })
  .option("--llm-judge", "Run LlmJudgeScorer after the agent completes")
  .option("--llm-judge-provider <provider>", "LLM judge provider (anthropic, openai)", { default: "anthropic" })
  .option("--llm-judge-model <model>", "LLM judge model slug")
  .option("--judge-gate", "Fail the run when the LLM judge score is below --judge-min-score")
  .option("--judge-min-score <score>", "Minimum LLM judge score when --judge-gate is set", { default: 0.7 })
  .option("--step-timeout <ms>", "Override step_timeout_ms for this run (ms per LLM provider call before abort)")
  .option("--save-baseline <path>", "Write a baseline snapshot JSON after the run completes")
  .option("--dry-run", "Print the resolved test case, config, and all overrides without executing")
  .option("--json", "Output run result as a single JSON object (suppresses the live UI; useful for scripting and CI)")
  .example("agr run hello-world")
  .example("agr run hello-world --config agent.yaml --verbose")
  .example("agr run hello-world --model claude-opus-4-8")
  .example("agr run hello-world --repeat 5")
  .example("agr run tasks/fix-bug/agr.yaml --fail-on-failure")
  .example("agr run hello-world --save-baseline baselines/main.json")
  .example("agr run hello-world --dry-run")
  .example("agr run hello-world --dry-run --model claude-opus-4-8 --json")
  .example("agr run hello-world --json")
  .action(async (testCase, options) => {
    try {
      await runSingleCommand(testCase, { ...options, json: options.json, repeat: options.repeat !== undefined ? Number(options.repeat) : undefined, minPassRate: options.minPassRate !== undefined ? Number(options.minPassRate) : undefined, untilPass: options.untilPass, maxAttempts: options.maxAttempts !== undefined ? Number(options.maxAttempts) : undefined, maxSteps: options.maxSteps !== undefined ? Number(options.maxSteps) : undefined, stepTimeout: options.stepTimeout !== undefined ? Number(options.stepTimeout) : undefined, temperature: options.temperature !== undefined ? Number(options.temperature) : undefined, saveBaseline: options.saveBaseline, dryRun: options.dryRun });
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
  .option("--report-dir <dir>", "Directory for auto-named report files (e.g. reports/); generates bench-<timestamp>.<ext> when --output is not given")
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
  .option("--only-unrun", "Run only the test cases with no recorded runs in the DB (no history); natural companion to agr list-tests --unrun; useful for initial coverage of a large suite")
  .option("--shuffle", "Randomize the order of test cases before running (reduces order-dependent bias in large suites)")
  .option("--sample <n>", "Randomly sample N test cases from the suite (useful for quick sanity checks on large suites without running everything)")
  .option("--print-ids", "Print all completed run IDs to stdout after the bench (one per line); enables shell pipelines like piping to agr trace")
  .option("--show-failures", "After bench completes, print a compact list of failing test cases with their run IDs and error messages; useful for quickly knowing which tasks to investigate")
  .option("--config-grid", "After multi-config bench completes, print a PASS/FAIL grid (test cases x configs) showing which test cases passed for which configs; requires at least 2 configs")
  .option("--model <model>", "Override the model for all agent configs in this bench run (e.g. claude-opus-4-8)")
  .option("--provider <provider>", "Override the provider for all agent configs in this bench run (e.g. anthropic, openai, openrouter)")
  .option("--temperature <n>", "Override the temperature for all agent configs in this bench run (0.0–1.0)")
  .option("--repeat <n>", "Run each test case N times per config to measure solve rate with statistical significance (e.g. --repeat 5 for pass@5)")
  .option("--max-steps <n>", "Override the max_steps for all agent configs in this bench run")
  .option("--step-timeout <ms>", "Override step_timeout_ms for all agent configs in this bench run (ms per LLM provider call before abort)")
  .option("--name <substring>", "Filter test cases by name substring (case-insensitive); applied after --tags and --skip-tags. Requires --suite.")
  .option("--config-filter <name>", "Filter loaded agent configs by name substring (case-insensitive); useful with --configs-dir or --manifest to run a subset without editing files")
  .option("--json", "Output bench results as a single JSON object and suppress the live dashboard; useful for scripting and CI pipelines")
  .example("agr bench hello-world")
  .example("agr bench hello-world --matrix matrix.yaml")
  .example("agr bench task-a task-b --configs agent.yaml")
  .example("agr bench --manifest bench.yaml")
  .example("agr bench --suite tasks --configs-dir ./agents")
  .example("agr bench --suite tasks --configs-dir ./agents --config-filter fast")
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
        reportDir: options.reportDir,
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
        onlyUnrun: options.onlyUnrun,
        shuffle: options.shuffle,
        sample: options.sample !== undefined ? Number(options.sample) : undefined,
        printIds: options.printIds,
        showFailures: options.showFailures,
        configGrid: options.configGrid,
        model: options.model,
        provider: options.provider,
        temperature: options.temperature !== undefined ? Number(options.temperature) : undefined,
        repeat: options.repeat !== undefined ? Number(options.repeat) : undefined,
        maxSteps: options.maxSteps !== undefined ? Number(options.maxSteps) : undefined,
        stepTimeout: options.stepTimeout !== undefined ? Number(options.stepTimeout) : undefined,
        name: options.name,
        configFilter: options.configFilter,
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
  .option("--model <model>", "Restrict stats to runs where the agent model contains this substring (case-insensitive)")
  .option("--sandbox <provider>", "Restrict stats to runs with this sandbox provider (substring match, e.g. docker, e2b)")
  .option("--passed", "Restrict stats to runs that passed")
  .option("--failed", "Restrict stats to runs that failed")
  .option("--by-config", "Show a per-config breakdown (solve rate, avg cost, avg duration), sorted by solve rate")
  .option("--by-test-case", "Show a per-test-case breakdown (solve rate, avg cost, avg duration), sorted by solve rate ascending (hardest first)")
  .option("--by-model", "Show a per-model breakdown (solve rate, avg cost, avg duration, avg tokens), sorted by solve rate; useful for comparing haiku vs opus vs sonnet across all runs")
  .option("--by-sandbox", "Show a per-sandbox breakdown (solve rate, avg cost, avg duration), sorted by solve rate; useful for comparing docker vs e2b performance")
  .option("--by-matrix", "Show a per-matrix-sweep breakdown (date, total, solve rate, avg cost), newest first; useful for tracking solve rate trends across bench runs")
  .option("--top <n>", "With --by-config, --by-test-case, --by-model, --by-sandbox, or --by-matrix, show only the top N entries")
  .option("--matrix-id <id>", "Restrict stats to runs belonging to a specific bench matrix sweep")
  .option("--last-matrix", "Restrict stats to runs from the most recent bench matrix sweep")
  .option("--trend", "Compare the --since window to the equal-length window before it (solve rate delta, run count delta, avg cost delta); requires --since")
  .option("--by-day", "Show a per-day breakdown (runs, solve rate, total cost), oldest first; useful for spotting when a regression started; combinable with --since and all filter flags")
  .option("--by-week", "Show a per-week breakdown (runs, solve rate, total cost), oldest first; higher-level view than --by-day for long-running eval suites; combinable with --since, --top, and all filter flags")
  .option("--sort-by <field>", "Sort --by-test-case, --by-config, and --by-model breakdowns by: solve-rate (default), cost (avg cost/run, most expensive first), runs (most runs first), or duration (avg duration/run, slowest first)")
  .option("--errors", "Show a deduplicated list of error messages across errored/failed runs, sorted by frequency; combinable with --since, --test-case, --config, and all filter flags")
  .option("--flaky", "Show test cases with inconsistent pass/fail results across runs, sorted by closest to 50/50; requires at least one pass and one fail in the matching runs")
  .option("--percentiles", "Add p50 and p95 percentile stats for cost and duration to the base status output and --json; useful for spotting outliers that skew the average")
  .option("--below <n>", "With --by-test-case, --by-config, or --by-model: only show entries with solve rate strictly below n% (0-100). Useful for filtering to failing/underperforming entries (e.g. --below 100 shows anything with at least one failure, --below 50 shows those failing more than half the time)")
  .option("--above <n>", "With --by-test-case, --by-config, or --by-model: only show entries with solve rate strictly above n% (0-100). Complement to --below; e.g. --above 80 shows consistently passing test cases, --above 0 excludes never-passing cases")
  .option("--grid", "Show a cross-tab matrix: rows are test cases, columns are agent configs, each cell shows latest PASS/FAIL/-- for that (test case, config) pair; combinable with --since, --test-case, --config, and filter flags; --json emits {testCaseIds, configIds, grid[{testCaseId, configs{}}]}")
  .option("--min-runs <n>", "With --by-test-case, --by-config, or --by-model: only show entries with at least N total runs; useful for excluding test cases that haven't been run enough to be statistically significant")
  .option("--rolling <n>", "With --by-test-case, --by-config, or --by-model: compute solve rate using only the most recent N runs per entry (newest first); useful for evaluating current agent quality without historical failures dragging down the score")
  .option("--show-ids", "With --by-test-case, --by-config, or --by-model: append the most recent run ID to each row as an agr trace shortcut; also included in --json output")
  .option("--solve-rate", "Print solve rate as a plain number (e.g. 83.3); with --json emits {solveRate, passedRuns, failedRuns, totalRuns, dbPath}; combinable with all filter flags; useful for CI shell conditions")
  .example("agr status")
  .example("agr status --json")
  .example("agr status --since 24h")
  .example("agr status --since 24h --trend")
  .example("agr status --since 7d --by-day")
  .example("agr status --since 30d --by-day --top 7")
  .example("agr status --by-test-case --sort-by cost")
  .example("agr status --by-config --sort-by cost --top 5")
  .example("agr status --since 7d --trend --test-case hello-world")
  .example("agr status --test-case hello-world")
  .example("agr status --config agent-fast")
  .example("agr status --model haiku")
  .example("agr status --failed")
  .example("agr status --by-config")
  .example("agr status --by-config --test-case hello-world")
  .example("agr status --by-test-case")
  .example("agr status --by-model")
  .example("agr status --by-sandbox")
  .example("agr status --by-matrix")
  .example("agr status --errors")
  .example("agr status --errors --since 24h")
  .example("agr status --flaky")
  .example("agr status --flaky --since 7d")
  .example("agr status --percentiles")
  .example("agr status --since 7d --percentiles --json")
  .action(async (options) => {
    try {
      if (options.passed && options.failed) {
        console.error("Error: --passed and --failed are mutually exclusive.");
        process.exit(1);
      }
      const passed = options.passed ? true : options.failed ? false : undefined;
      await statusCommand({ db: options.db, json: options.json, since: options.since, testCase: options.testCase, config: options.config, model: options.model, sandbox: options.sandbox, passed, byConfig: options.byConfig, byTestCase: options.byTestCase, byModel: options.byModel, bySandbox: options.bySandbox, byMatrix: options.byMatrix, top: options.top !== undefined ? Number(options.top) : undefined, matrixId: options.matrixId, lastMatrix: options.lastMatrix, trend: options.trend, byDay: options.byDay, sortBy: options.sortBy as "solve-rate" | "cost" | "runs" | "duration" | undefined, errors: options.errors, flaky: options.flaky, percentiles: options.percentiles, below: options.below !== undefined ? Number(options.below) : undefined, above: options.above !== undefined ? Number(options.above) : undefined, grid: options.grid, minRuns: options.minRuns !== undefined ? Number(options.minRuns) : undefined, rolling: options.rolling !== undefined ? Number(options.rolling) : undefined, showIds: options.showIds, solveRate: options.solveRate, byWeek: options.byWeek });
    } catch (err: any) {
      console.error(`Error executing status: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("count", "Count runs matching the given filters and print the total")
  .option("--db <path>", "Path to the SQLite database", { default: ".agr/db.sqlite" })
  .option("--since <duration|date>", "Only count runs after this point (e.g. 1h, 24h, 7d, or ISO date)")
  .option("--test-case <name>", "Only count runs for this specific test case (substring match)")
  .option("--config <name>", "Only count runs for this specific agent config (substring match)")
  .option("--model <model>", "Only count runs where the agent model contains this substring")
  .option("--sandbox <provider>", "Only count runs with this sandbox provider (substring match)")
  .option("--passed", "Only count runs that passed")
  .option("--failed", "Only count runs that failed")
  .option("--matrix-id <id>", "Only count runs belonging to a specific bench matrix sweep")
  .option("--last-matrix", "Only count runs from the most recent bench matrix sweep")
  .option("--json", "Output as JSON {total, passed, failed, dbPath} instead of a plain number")
  .option("--by-test-case", "Print a count per test case (sorted by total runs, most first). Plain: tab-separated. JSON: {total, byTestCase: [{testCaseId, total, passed, failed}]}")
  .option("--by-config", "Print a count per agent config (sorted by total runs, most first). Plain: tab-separated. JSON: {total, byConfig: [{agentConfigId, total, passed, failed}]}")
  .example("agr count")
  .example("agr count --passed --since 24h")
  .example("agr count --failed --test-case hello-world")
  .example("agr count --last-matrix --json")
  .example("agr count --model haiku --since 7d")
  .example("agr count --by-test-case --json | jq '.byTestCase[] | select(.total < 3)'")
  .example("agr count --by-config --since 7d")
  .action(async (options) => {
    try {
      if (options.passed && options.failed) {
        console.error("Error: --passed and --failed are mutually exclusive.");
        process.exit(1);
      }
      const passed = options.passed ? true : options.failed ? false : undefined;
      await countCommand({
        db: options.db,
        since: options.since,
        testCase: options.testCase,
        config: options.config,
        model: options.model,
        sandbox: options.sandbox,
        passed,
        matrixId: options.matrixId,
        lastMatrix: options.lastMatrix,
        json: options.json,
        byTestCase: options.byTestCase,
        byConfig: options.byConfig,
      });
    } catch (err: any) {
      console.error(`Error executing count: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("cost", "Print total cost for runs matching the given filters (default: all runs); plain output is a single dollar amount, useful for scripting")
  .option("--db <path>", "Path to the SQLite database", { default: ".agr/db.sqlite" })
  .option("--since <duration|date>", "Only include runs after this point (e.g. 1h, 24h, 7d, or ISO date)")
  .option("--test-case <name>", "Only include runs for this specific test case (substring match)")
  .option("--config <name>", "Only include runs for this specific agent config (substring match)")
  .option("--model <model>", "Only include runs where the agent model contains this substring")
  .option("--sandbox <provider>", "Only include runs with this sandbox provider (substring match)")
  .option("--passed", "Only include runs that passed")
  .option("--failed", "Only include runs that failed")
  .option("--matrix-id <id>", "Only include runs belonging to a specific bench matrix sweep")
  .option("--last-matrix", "Only include runs from the most recent bench matrix sweep")
  .option("--json", "Output as JSON {totalCostUsd, avgCostUsd, total, dbPath} instead of a plain dollar amount")
  .option("--by-test-case", "Print cost breakdown per test case (total cost, runs, avg cost/run), sorted most expensive first. Plain: tab-separated. JSON: {total, totalCostUsd, byTestCase: [{testCaseId, total, totalCostUsd, avgCostUsd}]}")
  .option("--by-config", "Print cost breakdown per agent config (total cost, runs, avg cost/run), sorted most expensive first. Same format as --by-test-case")
  .example("agr cost")
  .example("agr cost --since 24h")
  .example("agr cost --last-matrix")
  .example("agr cost --test-case hello-world --since 7d")
  .example("agr cost --json | jq .avgCostUsd")
  .example("agr cost --by-test-case")
  .example("agr cost --by-config --since 7d --json | jq '.byConfig[0]'")
  .action(async (options) => {
    try {
      if (options.passed && options.failed) {
        console.error("Error: --passed and --failed are mutually exclusive.");
        process.exit(1);
      }
      const passed = options.passed ? true : options.failed ? false : undefined;
      await costCommand({
        db: options.db,
        since: options.since,
        testCase: options.testCase,
        config: options.config,
        model: options.model,
        sandbox: options.sandbox,
        passed,
        matrixId: options.matrixId,
        lastMatrix: options.lastMatrix,
        json: options.json,
        byTestCase: options.byTestCase,
        byConfig: options.byConfig,
      });
    } catch (err: any) {
      console.error(`Error executing cost: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("list", "Browse saved runs from .agr/db.sqlite interactively")
  .option("--db <path>", "Path to the SQLite database", { default: ".agr/db.sqlite" })
  .option("--limit <n>", "Maximum number of runs to load", { default: 100 })
  .option("--all", "Load all runs, ignoring the --limit cap (equivalent to a very large --limit)")
  .option("--plain", "Print a plain text list instead of the interactive UI")
  .option("--since <duration|date>", "Only show runs after this point (e.g. 1h, 24h, 7d, or ISO date)")
  .option("--test-case <name>", "Only show runs for this specific test case (substring match)")
  .option("--config <name>", "Only show runs for this specific agent config (substring match)")
  .option("--passed", "Only show runs that passed")
  .option("--failed", "Only show runs that failed")
  .option("--model <model>", "Only show runs for this specific model (substring match on agentModel)")
  .option("--sort <field>", "Sort runs by field: date (default), cost, duration, steps")
  .option("--matrix-id <id>", "Only show runs belonging to a specific bench matrix sweep")
  .option("--last-matrix", "Only show runs from the most recent bench matrix sweep")
  .option("--sandbox <provider>", "Only show runs with this sandbox provider (substring match, e.g. docker, e2b)")
  .option("--error <substring>", "Only show runs whose error message contains this substring (case-insensitive); useful for finding all runs that failed with a specific error")
  .option("--latest", "Deduplicate to show only the most recent run per (test case, agent config) pair; gives a current-state snapshot rather than full history")
  .option("--min-cost <amount>", "Only show runs costing at least this many USD (e.g. 0.05 to find expensive outliers)")
  .option("--min-duration <ms>", "Only show runs lasting at least this many milliseconds (e.g. 60000 to find slow runs)")
  .option("--max-duration <ms>", "Only show runs lasting at most this many milliseconds (e.g. 10000 to find fast/early-terminating runs)")
  .option("--max-cost <amount>", "Only show runs costing at most this many USD (e.g. 0.01 to find cheap runs)")
  .option("--min-steps <n>", "Only show runs with at least this many steps")
  .option("--max-steps <n>", "Only show runs with at most this many steps")
  .option("--json", "Output runs as a JSON array (suppresses plain/TUI output; useful for scripting)")
  .example("agr list")
  .example("agr list --limit 20")
  .example("agr list --all --plain")
  .example("agr list --plain")
  .example("agr list --plain --since 24h")
  .example("agr list --plain --test-case hello-world")
  .example("agr list --plain --config agent-fast")
  .example("agr list --plain --failed")
  .example("agr list --plain --model claude-haiku")
  .example("agr list --plain --sort cost")
  .example("agr list --json | jq '[.[] | select(.passed == false)] | length'")
  .action(async (options) => {
    try {
      if (options.passed && options.failed) {
        console.error("Error: --passed and --failed are mutually exclusive.");
        process.exit(1);
      }
      const validSorts = ["date", "cost", "duration", "steps"];
      if (options.sort && !validSorts.includes(options.sort)) {
        console.error(`Error: --sort must be one of: ${validSorts.join(", ")}`);
        process.exit(1);
      }
      const passed = options.passed ? true : options.failed ? false : undefined;
      await listCommand({
        db: options.db,
        limit: options.all ? undefined : Number(options.limit),
        plain: options.plain,
        json: options.json,
        since: options.since,
        testCase: options.testCase,
        config: options.config,
        passed,
        model: options.model,
        sort: options.sort,
        matrixId: options.matrixId,
        lastMatrix: options.lastMatrix,
        sandbox: options.sandbox,
        error: options.error,
        minCost: options.minCost !== undefined ? Number(options.minCost) : undefined,
        maxCost: options.maxCost !== undefined ? Number(options.maxCost) : undefined,
        minSteps: options.minSteps !== undefined ? Number(options.minSteps) : undefined,
        maxSteps: options.maxSteps !== undefined ? Number(options.maxSteps) : undefined,
        minDuration: options.minDuration !== undefined ? Number(options.minDuration) : undefined,
        maxDuration: options.maxDuration !== undefined ? Number(options.maxDuration) : undefined,
        latest: options.latest,
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
  .option("--model <model>", "With --last, trace the most recent run where the agent model contains this substring")
  .option("--passed", "With --last, trace the most recent run that passed")
  .option("--failed", "With --last, trace the most recent run that failed")
  .option("--json", "Output trace as a JSON object; default mode emits {run,steps[]}, --quality emits {run,metrics}, --tools emits {run,toolUsage}")
  .option("--steps <range>", "Show only a range of steps by stepIndex (e.g. --steps 40-60 or --steps 42); useful for navigating long traces")
  .option("--grep <pattern>", "Show only steps whose label or content contains this substring (case-insensitive); combinable with --steps")
  .option("--full", "Print full step content without the 200-character truncation")
  .option("--top-cost <n>", "Show only the N most expensive steps, sorted by cost descending; useful for finding where a run's budget was spent")
  .option("--kind <type>", "Show only steps whose kind exactly matches this value (e.g. llm_response, tool_call, tool_result); combinable with --steps, --grep, --full, and all run-selection flags")
  .option("--step-count", "Print the total number of steps as a plain number (ignores all view/filter flags except run selection); --json emits {stepCount, filteredCount, runId}")
  .example("agr trace <runId>")
  .example("agr trace <runId> --tools")
  .example("agr trace <runId> --steps 40-60")
  .example("agr trace --last")
  .example("agr trace --last --quality")
  .example("agr trace --last --steps 0-9")
  .example("agr trace --last --grep error")
  .example("agr trace --last --grep tool_view_structure")
  .example("agr trace --last --test-case hello-world")
  .example("agr trace --last --config agent-a")
  .example("agr trace --last --model haiku --failed")
  .example("agr trace --last --json | jq .run.passed")
  .example("agr trace --last --tools --json | jq .toolUsage")
  .action(async (runId, options) => {
    try {
      if (!runId && !options.last) {
        console.error("Provide a run ID or use --last to trace the most recent run.");
        process.exit(1);
      }
      if (options.passed && options.failed) {
        console.error("Error: --passed and --failed are mutually exclusive.");
        process.exit(1);
      }
      const passed = options.passed ? true : options.failed ? false : undefined;
      await traceCommand(runId, { ...options, testCase: options.testCase, config: options.config, model: options.model, passed, json: options.json, steps: options.steps, grep: options.grep, full: options.full, topCost: options.topCost !== undefined ? Number(options.topCost) : undefined, kind: options.kind, stepCount: options.stepCount });
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
  .option("--all", "For `agr export traces`: export traces for all runs in the database without requiring any filter; use with --limit to cap the total")
  .option("--matrix-id <id>", "Filter runs by matrix id")
  .option("--last-matrix", "Export runs for the most recent matrix sweep (no --matrix-id needed)")
  .option("--limit <n>", "Maximum number of runs to export")
  .option("--since <duration|date>", "Only export runs after this point (e.g. 1h, 24h, 7d, or ISO date)")
  .option("--test-case <id>", "Filter exported runs/traces to those with a matching testCaseId (substring match)")
  .option("--config <id>", "Filter exported runs/traces to those with a matching agentConfigId (substring match)")
  .option("--passed", "Export only runs/traces that passed")
  .option("--failed", "Export only runs/traces that failed")
  .option("--model <name>", "Filter exported runs by model name substring (e.g. haiku, gpt-4o)")
  .option("--sort <field>", "Sort exported runs by field: date (default), cost, duration, steps")
  .option("--sandbox <provider>", "Filter exported runs by sandbox provider substring (e.g. docker, e2b)")
  .option("--error <substring>", "Filter exported runs to those with a matching error message substring")
  .option("--columns <list>", "Comma-separated list of columns to include (for runs): id,testCaseId,agentConfigId,passed,costUsd,durationMs,stepsCount,tokensIn,tokensOut,matrixId,metrics; omit metrics to avoid large JSON blobs in CSV")
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
        model: options.model,
        sort: options.sort,
        sandbox: options.sandbox,
        error: options.error,
        columns: options.columns ? (options.columns as string).split(",").map((c: string) => c.trim()) : undefined,
        all: options.all,
      });
    } catch (err: any) {
      console.error(`Error executing export: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("validate-toolkit <dir>", "Run security audit on a toolkit directory")
  .option("--strict", "Exit with code 1 on warnings as well as errors")
  .option("--json", "Output audit result as a JSON object {dir, passed, findings[]} with {file, severity, rule, message} per finding")
  .example("agr validate-toolkit ./toolkits/jetbrains-tools")
  .example("agr validate-toolkit ./toolkits/jetbrains-tools --json | jq .passed")
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
  .option("--first-and-last", "Compare the oldest and most recent runs (useful for tracking progress over time); combine with --test-case to scope to a single test case")
  .option("--test-case <name>", "With --last-two, compare the two most recent runs for this specific test case")
  .option("--config <name>", "With --last-two, compare the two most recent runs for this specific agent config (substring match)")
  .option("--json", "Output comparison result as a single JSON object {runA, runB, divergentCount, totalSteps, firstDivergence, steps[]}")
  .example("agr compare <runIdA> <runIdB> --only-diff")
  .example("agr compare --last-two --only-diff")
  .example("agr compare --last-two --test-case hello-world")
  .example("agr compare --last-two --config agent-a")
  .example("agr compare --last-two --json | jq .divergentCount")
  .example("agr compare --first-and-last --test-case hello-world")
  .example("agr compare --first-and-last --test-case hello-world --only-diff")
  .action(async (runIdA, runIdB, options) => {
    try {
      await compareCommand(runIdA, runIdB, { ...options, lastTwo: options.lastTwo, firstAndLast: options.firstAndLast, testCase: options.testCase, config: options.config });
    } catch (err: any) {
      console.error(`Error executing compare: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("cleanup", "List (or remove) leftover sandbox containers from killed/hung runs")
  .option("--yes", "Actually remove the listed containers (default: list only)")
  .option("--json", "Output result as a JSON object {found, removed, containers[]} with {id, image, status, ageMs} per container")
  .example("agr cleanup")
  .example("agr cleanup --yes")
  .example("agr cleanup --json | jq .found")
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
  .option("--json", "Output as a JSON object {tools[], auditFindings[], untracked?, ok} for CI scripting")
  .example("agr toolkit-list ./toolkits/jetbrains-tools")
  .example("agr toolkit-list ./toolkits/jetbrains-tools --check-config matrix-jetbrains-toolkits.yaml")
  .example("agr toolkit-list ./toolkits/jetbrains-tools --json")
  .example("agr toolkit-list ./toolkits/jetbrains-tools --check-config agent.yaml --json | jq .ok")
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
