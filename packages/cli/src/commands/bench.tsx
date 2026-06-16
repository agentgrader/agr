import { randomUUID } from "node:crypto";
import { basename, dirname, relative, resolve } from "path";
import { render } from "ink";
import React from "react";
import { initDb, saveTestCase, saveAgentConfig, getRunsByMatrixId, getRun, getTraces, type AgrDb } from "@agentgrader/store";
import { runBenchmark, summaryFromRunStates, auditToolkitDirectory, hasAuditErrors, type TestCase, type AgentConfig } from "@agentgrader/core";
import { evaluateBenchExit } from "../lib/bench-exit";
import { buildExtraScorers } from "../lib/extra-scorers";
import { buildReportFromRunIds } from "../lib/report/build-report";
import { writeReport, type ReportFormat } from "../lib/report/write-report";
import {
  buildBaselineSnapshotFromRunIds,
  saveBaselineSnapshot,
} from "../lib/baseline";
import { maybeAutoExportOnBench } from "./export";
import { resolveSandbox } from "../lib/resolve-sandbox";
import { expandMatrix, aggregateResults, paretoFront } from "@agentgrader/optimizer";
import { resolveAdapters } from "../lib/resolve-adapters";
import { countToolCalls, mergeToolCounts, printToolUsageBlock } from "../lib/tool-usage";
import { Dashboard, type RunState } from "../ui/Dashboard";
import {
  loadBenchManifest,
  resolveManifestAgentConfigPaths,
  resolveManifestSuiteDir,
} from "../lib/load-bench-manifest";
import { loadMatrix } from "../lib/load-matrix";
import {
  loadAgentConfigsFromPaths,
  resolveAgentConfigPathList,
} from "../lib/resolve-agent-config-paths";
import {
  loadTestCase,
  testCaseToDbRow,
  findTestCaseYamlFiles,
  resolveSharedAgentConfigFromTestCases,
  resolveTestCasePath,
} from "../lib/load-test-case";

export async function runBenchCommand(opts: {
  configs?: string;
  configsDir?: string;
  suite?: string;
  concurrency?: number;
  matrix?: string;
  manifest?: string;
  adapters?: string;
  failOnFailure?: boolean;
  minSolveRate?: number;
  minSolveRateScope?: "global" | "per-config";
  report?: ReportFormat;
  output?: string;
  reportIncludeTraces?: boolean;
  saveBaseline?: string;
  sandbox?: string;
  strictToolkits?: boolean;
  llmJudge?: boolean;
  llmJudgeProvider?: "anthropic" | "openai";
  llmJudgeModel?: string;
  judgeGate?: boolean;
  judgeMinScore?: number;
  testCaseArgs?: string[];
  dryRun?: boolean;
  tags?: string[];
}) {
  let suiteDir: string | undefined;
  let concurrency = opts.concurrency ?? 2;
  let agentConfigs: AgentConfig[] = [];
  let matrixId: string | undefined;

  if (opts.manifest) {
    const manifestPath = resolve(opts.manifest);
    const manifest = loadBenchManifest(manifestPath);
    suiteDir = resolveManifestSuiteDir(manifest, manifestPath);
    if (manifest.concurrency !== undefined && opts.concurrency === undefined) {
      concurrency = manifest.concurrency;
    }
    if (opts.matrix) {
      throw new Error("Use either --manifest or --matrix, not both.");
    }
    const configPaths = resolveManifestAgentConfigPaths(manifest, manifestPath);
    agentConfigs = loadAgentConfigsFromPaths(configPaths);
    console.log(
      `Bench manifest "${manifest.name ?? manifestPath}" loaded ${agentConfigs.length} agent config(s) from ${configPaths.length} file(s).`,
    );
  } else {
    if (opts.suite) {
      suiteDir = resolve(opts.suite);
    } else if (!opts.testCaseArgs?.length) {
      throw new Error("--suite is required unless --manifest is provided, or test case names are given as arguments.");
    }

    if (opts.matrix) {
      if (opts.configs || opts.configsDir) {
        throw new Error("Use either --matrix or --configs/--configs-dir, not both.");
      }
      const matrix = loadMatrix(opts.matrix);
      agentConfigs = expandMatrix(matrix);
      matrixId = randomUUID();
      console.log(
        `Matrix "${matrix.name}" expanded to ${agentConfigs.length} agent config(s) (matrixId: ${matrixId})`,
      );
    } else if (opts.configs || opts.configsDir) {
      const configPaths = resolveAgentConfigPathList({
        commaSeparated: opts.configs,
        dir: opts.configsDir,
      });
      agentConfigs = loadAgentConfigsFromPaths(configPaths);
      if (opts.configsDir) {
        console.log(`Loaded ${agentConfigs.length} agent config(s) from ${opts.configsDir}.`);
      } else if (agentConfigs.length === 1) {
        console.log(`Config: ${agentConfigs[0]!.name} (model: ${agentConfigs[0]!.model ?? "?"})`);
      } else {
        console.log(`Loaded ${agentConfigs.length} agent config(s): ${agentConfigs.map(ac => ac.name).join(", ")}`);
      }
    }
  }

  let yamlFiles: string[];
  let testCases: TestCase[];

  if (suiteDir) {
    const allYamlFiles = findTestCaseYamlFiles(suiteDir);
    if (allYamlFiles.length === 0) {
      console.error(`No test cases found in suite directory: ${suiteDir}`);
      process.exit(1);
    }
    const allTestCases = allYamlFiles.map(f => loadTestCase(f));
    console.log(`Suite: ${allTestCases.length} test case(s) in ${relative(process.cwd(), suiteDir) || suiteDir}`);

    let pairs = allTestCases.map((tc, i) => ({ tc, yaml: allYamlFiles[i]! }));

    if (opts.testCaseArgs?.length) {
      const filter = new Set(opts.testCaseArgs);
      pairs = pairs.filter(({ tc, yaml }) => filter.has(tc.name) || filter.has(basename(dirname(yaml))));
      if (pairs.length === 0) {
        console.error(`No test cases matched: ${opts.testCaseArgs.join(", ")}`);
        process.exit(1);
      }
      console.log(
        `Filtered suite to ${pairs.length} of ${allTestCases.length} test case(s): ${pairs.map(p => p.tc.name).join(", ")}`,
      );
    }

    if (opts.tags?.length) {
      const tagSet = new Set(opts.tags);
      const beforeCount = pairs.length;
      pairs = pairs.filter(({ tc }) => (tc.tags ?? []).some(t => tagSet.has(t)));
      if (pairs.length === 0) {
        console.error(`No test cases with tags [${opts.tags.join(", ")}] found in suite: ${suiteDir}`);
        process.exit(1);
      }
      if (pairs.length < beforeCount) {
        console.log(
          `Tag filter [${opts.tags.join(", ")}]: ${pairs.length} of ${beforeCount} test case(s) matched`,
        );
      }
    }

    yamlFiles = pairs.map(p => p.yaml);
    testCases = pairs.map(p => p.tc);
  } else {
    yamlFiles = opts.testCaseArgs!.map(arg => resolveTestCasePath(arg));
    testCases = yamlFiles.map(f => loadTestCase(f));
    console.log(`Loaded ${testCases.length} test case(s): ${testCases.map(tc => tc.name).join(", ")}`);
  }

  if (agentConfigs.length === 0) {
    const sharedAgentConfig = resolveSharedAgentConfigFromTestCases(testCases);
    const configPaths = resolveAgentConfigPathList({
      explicitPaths: [sharedAgentConfig],
    });
    agentConfigs = loadAgentConfigsFromPaths(configPaths);
    const acLabel = agentConfigs.length === 1 ? "config" : "configs";
    console.log(
      `Using shared agent_config from agr.yaml: ${sharedAgentConfig} (${agentConfigs.length} ${acLabel}).`,
    );
  }

  if (opts.dryRun) {
    const cwd = process.cwd();
    const totalRuns = testCases.length * Math.max(agentConfigs.length, 1);
    const configLabel = agentConfigs.length === 1 ? "config" : "configs";
    console.log(
      `\nBench dry run -- ${testCases.length} test case(s) x ${agentConfigs.length} ${configLabel} = ${totalRuns} run(s)\n`,
    );
    console.log("Test cases:");
    const tcNameWidth = Math.max(...testCases.map(tc => tc.name.length));
    const anyTags = testCases.some(tc => tc.tags?.length);
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i]!;
      const rel = relative(cwd, yamlFiles[i]!);
      const tagSuffix = anyTags && tc.tags?.length ? `  [${tc.tags.join(", ")}]` : "";
      console.log(`  ${tc.name.padEnd(tcNameWidth)}  ${rel}${tagSuffix}`);
    }
    console.log("");
    if (agentConfigs.length > 0) {
      console.log("Agent configs:");
      const acNameWidth = Math.max(...agentConfigs.map(ac => ac.name.length));
      const acModelWidth = Math.max(...agentConfigs.map(ac => (ac.model ?? "").length));
      for (const ac of agentConfigs) {
        const name = ac.name.padEnd(acNameWidth);
        const model = (ac.model ?? "").padEnd(acModelWidth);
        console.log(`  ${name}  ${model}`);
      }
      console.log("");
    }
    const concurrency = opts.concurrency ?? 2;
    console.log(`Total: ${totalRuns} job(s)  concurrency: ${concurrency}`);
    console.log("\nRe-run without --dry-run to execute.");
    return;
  }

  // 3. open the sqlite db
  const db = initDb();

  // persist test case + config definitions so the db has context for each run
  for (const tc of testCases) {
    await saveTestCase(db, testCaseToDbRow(tc));
  }

  if (opts.strictToolkits) {
    const toolkitPaths = new Set<string>();
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i]!;
      const yamlDir = resolve(yamlFiles[i]!, "..");
      for (const t of tc.toolkits ?? []) toolkitPaths.add(resolve(yamlDir, t));
    }
    for (const ac of agentConfigs) {
      for (const t of ac.toolkits ?? []) toolkitPaths.add(resolve(t));
    }
    for (const toolkitPath of toolkitPaths) {
      const findings = auditToolkitDirectory(toolkitPath);
      if (hasAuditErrors(findings)) {
        console.error(`Toolkit security audit failed for ${toolkitPath}`);
        process.exit(1);
      }
    }
  }

  for (const ac of agentConfigs) {
    await saveAgentConfig(db, {
      id: ac.id || ac.name,
      name: ac.name,
      model: ac.model,
      maxSteps: ac.max_steps,
      temperature: ac.temperature,
      systemPrompt: ac.system_prompt,
      tools: JSON.stringify(ac.tools),
      createdAt: Math.floor(Date.now() / 1000),
    });
  }

  // 4. wire up providers
  const sandboxProvider = resolveSandbox(opts.sandbox ?? "docker");
  const adapters = resolveAdapters(
    opts.adapters ? opts.adapters.split(",") : ["ai-sdk"],
  );

  // 5. render the live dashboard
  const runStates: Record<string, RunState> = {};
  const testCaseIds = testCases.map((tc) => tc.id || tc.name);
  const configIds = agentConfigs.map((ac) => ac.id || ac.name);

  const { rerender, waitUntilExit } = render(
    <Dashboard
      runs={runStates}
      testCases={testCaseIds}
      configs={configIds}
      isFinished={false}
    />
  );

  const onRunUpdate = (run: any) => {
    const key = `${run.testCaseId}_${run.agentConfigId}`;
    runStates[key] = run;
    rerender(
      <Dashboard
        runs={runStates}
        testCases={testCaseIds}
        configs={configIds}
        isFinished={false}
      />
    );
  };

  // 6. kick off the benchmark
  try {
    await runBenchmark({
      testCases,
      agentConfigs,
      adapters,
      sandboxProvider,
      db,
      concurrency,
      onRunUpdate,
      extraScorers: buildExtraScorers({
        llmJudge: opts.llmJudge,
        llmJudgeProvider: opts.llmJudgeProvider,
        llmJudgeModel: opts.llmJudgeModel,
        judgeGate: opts.judgeGate,
        judgeMinScore: opts.judgeMinScore,
      }),
      matrixId,
    });
  } catch (err) {
    console.error("Benchmark runner encountered an error:", err);
  }

  // re-render one last time with isFinished so the dashboard shows the final state
  rerender(
    <Dashboard
      runs={runStates}
      testCases={testCaseIds}
      configs={configIds}
      isFinished={true}
    />
  );

  printTagBreakdown(testCases, agentConfigs, runStates);

  await printToolUsageByConfig(db, agentConfigs, runStates);

  await printToolAdoptionByConfig(db, agentConfigs, runStates);

  if (matrixId) {
    await printMatrixSummary(db, matrixId, agentConfigs);
  }

  const summary = summaryFromRunStates(runStates, configIds);

  if (!matrixId) {
    const totalCost = Object.values(runStates).reduce((acc, r) => acc + (r.costUsd || 0), 0);
    const configCount = Object.keys(summary.byConfig).length;
    if (configCount > 1) {
      const pct = summary.totalRuns > 0 ? ((summary.solveRate) * 100).toFixed(0) : "0";
      console.log(`\nResult: ${summary.passedRuns}/${summary.totalRuns} PASS (${pct}%)  cost: $${totalCost.toFixed(4)}`);
      const costByConfig = new Map<string, number>();
      for (const r of Object.values(runStates)) {
        costByConfig.set(r.agentConfigId, (costByConfig.get(r.agentConfigId) ?? 0) + (r.costUsd || 0));
      }
      const nameWidth = Math.max(...Object.keys(summary.byConfig).map(id => id.length));
      for (const [configId, stats] of Object.entries(summary.byConfig)) {
        const pct = stats.totalRuns > 0 ? ((stats.solveRate) * 100).toFixed(0) : "0";
        const cost = costByConfig.get(configId) ?? 0;
        console.log(`  ${configId.padEnd(nameWidth)}  ${stats.passedRuns}/${stats.totalRuns} PASS (${pct}%)  $${cost.toFixed(4)}`);
      }
    } else {
      const pct = summary.totalRuns > 0 ? ((summary.solveRate) * 100).toFixed(0) : "0";
      console.log(`\nResult: ${summary.passedRuns}/${summary.totalRuns} PASS (${pct}%)  cost: $${totalCost.toFixed(4)}`);
    }
  }

  if (opts.report && opts.output) {
    const runIds = Object.values(runStates)
      .map((r) => r.runId)
      .filter((id): id is string => !!id);
    const report = await buildReportFromRunIds(
      db,
      runIds,
      summary,
      agentConfigs,
      !!opts.reportIncludeTraces,
    );
    const path = writeReport(report, opts.report, opts.output);
    console.log(`Report written to ${path}`);
  }

  if (opts.saveBaseline) {
    const runIds = Object.values(runStates)
      .map((r) => r.runId)
      .filter((id): id is string => !!id);
    const snapshot = await buildBaselineSnapshotFromRunIds(db, runIds, {
      suite: suiteDir,
      configs: configIds,
    });
    const path = saveBaselineSnapshot(snapshot, opts.saveBaseline);
    console.log(`Baseline snapshot written to ${path}`);
  }

  const runIdsForExport = Object.values(runStates)
    .map((r) => r.runId)
    .filter((id): id is string => !!id);
  await maybeAutoExportOnBench(db, matrixId, runIdsForExport);

  const { exitCode, reasons } = evaluateBenchExit(summary, {
    failOnFailure: opts.failOnFailure,
    minSolveRate: opts.minSolveRate,
    minSolveRateScope: opts.minSolveRateScope,
  });

  if (reasons.length > 0) {
    console.error("\n[FAIL] Benchmark gate failed:");
    for (const reason of reasons) {
      console.error(`  - ${reason}`);
    }
  }

  let nextHint: string;
  if (matrixId) {
    nextHint = `Next: agr export runs --matrix-id ${matrixId} --format jsonl --output sweep.jsonl  |  agr list`;
  } else if (agentConfigs.length > 1) {
    nextHint = `Next: agr list  |  agr compare <idA> <idB> --only-diff  |  agr export runs --format jsonl --output runs.jsonl`;
  } else {
    nextHint = `Next: agr trace --last  |  agr trace --last --quality  |  agr list`;
  }
  console.log(`\n${nextHint}`);

  process.exit(exitCode);
}

/**
 * Aggregates all runs from this matrix sweep by agent config and prints a
 * solve-rate / cost / quality breakdown, marking the Pareto-optimal configs.
 */
async function printMatrixSummary(db: AgrDb, matrixId: string, agentConfigs: AgentConfig[]) {
  const runs = await getRunsByMatrixId(db, matrixId);
  const aggregates = aggregateResults(runs, agentConfigs);
  if (aggregates.length === 0) return;

  const front = paretoFront(aggregates);
  const frontIds = new Set(front.map((a) => a.agentConfigId));
  const includesQuality = front.some((a) => a.avgQuality?.linterViolations !== undefined);

  console.log("\n================ MATRIX SUMMARY ================");
  for (const agg of aggregates) {
    const marker = frontIds.has(agg.agentConfigId) ? "*" : " ";
    const solveRatePct = (agg.solveRate * 100).toFixed(0);
    const lint =
      agg.avgQuality?.linterViolations !== undefined
        ? ` lint:${agg.avgQuality.linterViolations.toFixed(1)}`
        : "";
    console.log(
      `${marker} ${agg.agentConfigName.padEnd(36)} solve:${solveRatePct.padStart(3)}% (${agg.passedRuns}/${agg.totalRuns}) cost:$${agg.avgCostUsd.toFixed(4)}${lint}`,
    );
  }
  console.log(
    `\n* = Pareto-optimal (solve rate, cost${includesQuality ? ", lint violations" : ""})`,
  );
  console.log("=================================================\n");
}

async function printToolUsageByConfig(
  db: AgrDb,
  agentConfigs: AgentConfig[],
  runStates: Record<string, RunState>,
) {
  const byConfig = new Map<string, Map<string, number>>();

  for (const run of Object.values(runStates)) {
    if (run.status !== "completed" && run.status !== "failed") continue;
    if (!run.runId) continue;

    const steps = await getTraces(db, run.runId);
    const runCounts = countToolCalls(steps);
    const configCounts = byConfig.get(run.agentConfigId) ?? new Map<string, number>();
    mergeToolCounts(configCounts, runCounts);
    byConfig.set(run.agentConfigId, configCounts);
  }

  if (byConfig.size === 0) return;

  console.log("\n================ TOOL USAGE BY CONFIG ================");
  for (const ac of agentConfigs) {
    const configId = ac.id || ac.name;
    const counts = byConfig.get(configId);
    if (!counts || counts.size === 0) continue;
    console.log(`${configId}:`);
    printToolUsageBlock(counts, { indent: "  " });
    console.log("");
  }
  console.log(
    "Tip: per-run detail with `agr trace <runId> --tools`. Compare two runs with `agr compare`.",
  );
  console.log("=======================================================\n");
}

/**
 * Aggregates `metrics["tool-adoption"]` (from `require_tools_before_submit`)
 * across all runs of each agent config, showing how often each required
 * tool was missing before submit. Silent if no config configured
 * `require_tools_before_submit`.
 */
async function printToolAdoptionByConfig(
  db: AgrDb,
  agentConfigs: AgentConfig[],
  runStates: Record<string, RunState>,
) {
  const byConfig = new Map<string, { total: number; missingCounts: Map<string, number> }>();

  for (const run of Object.values(runStates)) {
    if (run.status !== "completed" && run.status !== "failed") continue;
    if (!run.runId) continue;

    const row = await getRun(db, run.runId);
    const toolAdoption = row?.metrics ? safeParseJson(row.metrics)?.["tool-adoption"] : undefined;
    if (!toolAdoption) continue;

    const entry = byConfig.get(run.agentConfigId) ?? { total: 0, missingCounts: new Map<string, number>() };
    entry.total++;
    for (const name of toolAdoption.missing ?? []) {
      entry.missingCounts.set(name, (entry.missingCounts.get(name) ?? 0) + 1);
    }
    byConfig.set(run.agentConfigId, entry);
  }

  if (byConfig.size === 0) return;

  console.log("\n================ TOOL ADOPTION BY CONFIG ================");
  for (const ac of agentConfigs) {
    const configId = ac.id || ac.name;
    const entry = byConfig.get(configId);
    if (!entry) continue;
    if (entry.missingCounts.size === 0) {
      console.log(`${configId}: all required tool(s) used in ${entry.total} run(s)`);
      continue;
    }
    console.log(`${configId}:`);
    for (const [name, count] of [...entry.missingCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name.padEnd(20)} missing in ${count}/${entry.total} run(s)`);
    }
  }
  console.log("==========================================================\n");
}

function safeParseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Prints a per-tag pass-rate breakdown across all runs, e.g. "regression: 4/6 (67%)".
 * Useful for spotting whether a model is systematically weak on a category
 * of tasks (off-by-one, async, etc.) - an idea borrowed from SWE-bench's
 * per-repo / per-difficulty breakdowns.
 */
function printTagBreakdown(
  testCases: TestCase[],
  agentConfigs: AgentConfig[],
  runStates: Record<string, RunState>
) {
  const tagStats: Record<string, { passed: number; total: number }> = {};

  for (const tc of testCases) {
    const tags = tc.tags ?? [];
    if (tags.length === 0) continue;

    for (const ac of agentConfigs) {
      const key = `${tc.id || tc.name}_${ac.id || ac.name}`;
      const run = runStates[key];
      if (!run || run.status === "running") continue;

      for (const tag of tags) {
        const stats = (tagStats[tag] ??= { passed: 0, total: 0 });
        stats.total++;
        if (run.passed) stats.passed++;
      }
    }
  }

  const tags = Object.keys(tagStats).sort();
  if (tags.length === 0) return;

  console.log("\n================ TAG BREAKDOWN ================");
  for (const tag of tags) {
    const { passed, total } = tagStats[tag];
    const pct = total > 0 ? ((passed / total) * 100).toFixed(0) : "0";
    console.log(`${tag.padEnd(24)} ${passed}/${total} (${pct}%)`);
  }
  console.log("=================================================\n");
}
