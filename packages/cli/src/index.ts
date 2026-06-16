import "dotenv/config";
import { cac } from "cac";
import { cleanupCommand } from "./commands/cleanup";
import { compareCommand } from "./commands/compare";
import { compareBaselineCommand } from "./commands/compare-baseline";
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

const cli = cac("agr");

cli
  .command("init [dir]", "Scaffold a minimal, runnable agentgrader project (agent config + sample test case)")
  .option("--force", "Overwrite agent.yaml if it already exists")
  .option("--blank", "Only write agent.yaml and an empty tasks/ dir, without the hello-world sample test case")
  .example("agr init")
  .example("agr init my-project")
  .example("agr init --blank")
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
  .example("agr list-tests")
  .example("agr list-tests tasks/")
  .example("agr list-tests --json")
  .action(async (dir, options) => {
    try {
      await listTestsCommand(dir, { json: options.json });
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
  .option("--adapter <adapter>", "Agent adapter to use (ai-sdk, acp)", { default: "ai-sdk" })
  .option(
    "--verbose",
    "Stream agent steps live to the console as they happen",
  )
  .option("--fail-on-failure", "Exit with code 1 if the run does not pass")
  .option("--report <format>", "Write a report (json, jsonl, html, md)")
  .option("--output <path>", "Output path for --report")
  .option("--report-include-traces", "Include full step traces in --report output")
  .option("--sandbox <provider>", "Sandbox provider (docker, e2b)", { default: "docker" })
  .option("--llm-judge", "Run LlmJudgeScorer after the agent completes")
  .option("--llm-judge-provider <provider>", "LLM judge provider (anthropic, openai)", { default: "anthropic" })
  .option("--llm-judge-model <model>", "LLM judge model slug")
  .option("--judge-gate", "Fail the run when the LLM judge score is below --judge-min-score")
  .option("--judge-min-score <score>", "Minimum LLM judge score when --judge-gate is set", { default: 0.7 })
  .action(async (testCase, options) => {
    try {
      await runSingleCommand(testCase, options);
    } catch (err: any) {
      console.error(`Error executing run: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("bench [...testCases]", "Run a benchmark matrix of multiple test cases and configs")
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
  .option("--fail-on-failure", "Exit with code 1 if any run in the benchmark fails")
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
      });
    } catch (err: any) {
      console.error(`Error executing benchmark: ${err.message}`);
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
  .example("agr validate fix-greeting")
  .example("agr validate fix-greeting --strict")
  .example("agr validate task-a task-b task-c --strict")
  .action(async (testCases, options) => {
    try {
      if (!testCases || testCases.length === 0) {
        console.error("No test case specified. Usage: agr validate <testCase> [testCase...]");
        process.exit(1);
      }
      await validateCommand(testCases, options);
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
  .command("list", "Browse saved runs from .agr/db.sqlite interactively")
  .option("--db <path>", "Path to the SQLite database", { default: ".agr/db.sqlite" })
  .option("--limit <n>", "Maximum number of runs to load", { default: 100 })
  .option("--plain", "Print a plain text list instead of the interactive UI")
  .example("agr list")
  .example("agr list --limit 20")
  .example("agr list --plain")
  .action(async (options) => {
    try {
      await listCommand({
        db: options.db,
        limit: Number(options.limit),
        plain: options.plain,
      });
    } catch (err: any) {
      console.error(`Error executing list: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("trace <runId>", "Show the step trace and metrics for a single run")
  .option(
    "--quality",
    "Show only the quality-metrics breakdown (static-quality, llm-judge, diff, localization)",
  )
  .option(
    "--tools",
    "Show only a tool-usage breakdown (call count per tool name) instead of the full trace",
  )
  .example("agr trace <runId> --tools")
  .action(async (runId, options) => {
    try {
      await traceCommand(runId, options);
    } catch (err: any) {
      console.error(`Error executing trace: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("export <subcommand>", "Export runs or traces (runs, traces)")
  .option("--format <format>", "Export format (json, jsonl, otlp)", { default: "json" })
  .option("--output <path>", "Output file path")
  .option("--db <path>", "SQLite database path", { default: ".agr/db.sqlite" })
  .option("--run-id <id>", "Run id for trace export")
  .option("--matrix-id <id>", "Filter runs by matrix id")
  .option("--limit <n>", "Maximum number of runs to export")
  .example("agr export runs --format jsonl --output runs.jsonl")
  .example("agr export traces --run-id <runId> --format otlp --output trace.json")
  .action(async (subcommand, options) => {
    try {
      await exportCommand(subcommand, {
        format: options.format,
        output: options.output,
        db: options.db,
        runId: options.runId,
        matrixId: options.matrixId,
        limit: options.limit ? Number(options.limit) : undefined,
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
  .command("compare <runIdA> <runIdB>", "Compare the step traces of two runs side by side")
  .option("--full", "Print full step content without truncation")
  .option(
    "--only-diff",
    "Show only divergent steps plus one step of context before and after each",
  )
  .example("agr compare <runIdA> <runIdB> --only-diff")
  .action(async (runIdA, runIdB, options) => {
    try {
      await compareCommand(runIdA, runIdB, options);
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
