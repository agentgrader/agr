import "dotenv/config";
import { cac } from "cac";
import { runBenchCommand } from "./commands/bench";
import { importPrCommand } from "./commands/import-pr";
import { runSingleCommand } from "./commands/run";
import { traceCommand } from "./commands/trace";
import { validateCommand } from "./commands/validate";

const cli = cac("agr");

cli
  .command("run <testCase>", "Run a single agent test case")
  .option("--config <config>", "Path to an AgentConfig YAML file")
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
  .option("--suite <suite>", "Path to test suite directory containing test cases")
  .option("--concurrency <concurrency>", "Number of parallel sandbox executions", { default: 2 })
  .option(
    "--matrix <matrix>",
    "Path to an optimizer matrix YAML file - expands into agent configs and prints a Pareto summary afterwards (alternative to --configs)",
  )
  .action(async (options) => {
    if (!options.suite || (!options.configs && !options.matrix)) {
      console.error("Error: --suite and either --configs or --matrix are required for benchmarking.");
      process.exit(1);
    }
    try {
      await runBenchCommand({
        configs: options.configs,
        suite: options.suite,
        concurrency: Number(options.concurrency),
        matrix: options.matrix,
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
  .action(async (testCase) => {
    try {
      await validateCommand(testCase);
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
  .option("--clone-fixture", "Clone the repo and check out the PR's base commit into ./fixture")
  .option("--validate", "Run `agr validate` against the scaffolded test case afterwards")
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
  .action(async (runId, options) => {
    try {
      await traceCommand(runId, options);
    } catch (err: any) {
      console.error(`Error executing trace: ${err.message}`);
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
