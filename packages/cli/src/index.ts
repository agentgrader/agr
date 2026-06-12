import "dotenv/config";
import { cac } from "cac";
import { compareCommand } from "./commands/compare";
import { runBenchCommand } from "./commands/bench";
import { importPrCommand } from "./commands/import-pr";
import { runSingleCommand } from "./commands/run";
import { traceCommand } from "./commands/trace";
import { validateCommand } from "./commands/validate";

const cli = cac("agr");

cli
  .command("run <testCase>", "Run a single agent test case")
  .option("--config <config>", "Path to an AgentConfig YAML file")
  .option(
    "--verbose",
    "Stream agent steps live to the console as they happen",
  )
  .action(async (testCase, options) => {
    try {
      await runSingleCommand(testCase, options);
    } catch (err: any) {
      console.error(`Error executing run: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command("bench", "Run a benchmark matrix of multiple test cases and configs")
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
  .option("--concurrency <concurrency>", "Number of parallel sandbox executions", { default: 2 })
  .option(
    "--matrix <matrix>",
    "Path to an optimizer matrix YAML file - expands into agent configs and prints a Pareto summary afterwards (alternative to --configs)",
  )
  .example("agr bench --manifest bench.yaml")
  .example("agr bench --suite tasks --configs-dir ./agents")
  .example("agr bench --suite tasks --configs agent.yaml,agent-openrouter.yaml")
  .example("agr bench --suite tasks --matrix optimizer-matrix.yaml")
  .action(async (options) => {
    if (!options.configs && options.config) {
      options.configs = options.config;
    }

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
    } else if (!options.suite) {
      console.error(
        "Error: provide --manifest, or --suite with one of --configs, --config, --configs-dir, --matrix, or a shared agent_config in every agr.yaml.",
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
      });
    } catch (err: any) {
      console.error(`Error executing benchmark: ${err.message}`);
      process.exit(1);
    }
  });

cli
  .command(
    "validate <testCase>",
    "Validate a test case definition (fixture, fail_to_pass/pass_to_pass, gold patch)",
  )
  .option(
    "--strict",
    "Exit with code 1 if test_command or fail_to_pass/pass_to_pass are missing",
  )
  .action(async (testCase, options) => {
    try {
      await validateCommand(testCase, options);
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

cli.help();

try {
  cli.parse();
} catch (err: any) {
  if (err.name === "CACError") {
    console.error(`\n❌ ${err.message}\n`);
    cli.outputHelp();
    process.exit(1);
  }
  throw err;
}
