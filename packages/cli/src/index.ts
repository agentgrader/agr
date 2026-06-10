import { cac } from "cac";
import { runBenchCommand } from "./commands/bench";
import { importPrCommand } from "./commands/import-pr";
import { runSingleCommand } from "./commands/run";
import { validateCommand } from "./commands/validate";

const cli = cac("crucible");

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
  .action(async (options) => {
    if (!options.configs || !options.suite) {
      console.error("Error: --configs and --suite are required for benchmarking.");
      process.exit(1);
    }
    try {
      await runBenchCommand({
        configs: options.configs,
        suite: options.suite,
        concurrency: Number(options.concurrency),
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
  .action(async (repo, prNumber, options) => {
    try {
      await importPrCommand(repo, prNumber, options);
    } catch (err: any) {
      console.error(`Error executing import-pr: ${err.message}`);
      process.exit(1);
    }
  });

cli.help();
cli.parse();
