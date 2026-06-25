import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "path";
import { render } from "ink";
import React from "react";
import { initDb, saveTestCase, saveAgentConfig, getRunsByMatrixId, getRun, getTraces, listRuns, type AgrDb } from "@agentgrader/store";
import { runBenchmark, summaryFromRunStates, auditToolkitDirectory, hasAuditErrors, type TestCase, type AgentConfig } from "@agentgrader/core";
import { evaluateBenchExit } from "../lib/bench-exit";
import { buildExtraScorers } from "../lib/extra-scorers";
import { buildReportFromRunIds } from "../lib/report/build-report";
import { buildTimestampedReportPath, writeReport, type ReportFormat } from "../lib/report/write-report";
import {
  buildBaselineSnapshotFromRunIds,
  saveBaselineSnapshot,
} from "../lib/baseline";
import { maybeAutoExportOnBench } from "./export";
import { resolveSandbox } from "../lib/resolve-sandbox";
import { expandMatrix, aggregateResults, paretoFront } from "@agentgrader/optimizer";
import { resolveAdapters } from "../lib/resolve-adapters";
import { parseSince } from "../lib/parse-since";
import { countToolCalls, mergeToolCounts, printToolUsageBlock } from "../lib/tool-usage";
import { Dashboard, type RunState } from "../ui/Dashboard";
import {
  loadBenchManifest,
  resolveManifestAgentConfigPaths,
  resolveManifestSuiteDir,
} from "../lib/load-bench-manifest";
import { loadMatrix } from "../lib/load-matrix";
import { formatDuration } from "../lib/format-relative-time";
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
  minPassCount?: number;
  report?: ReportFormat;
  output?: string;
  reportDir?: string;
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
  limit?: number;
  onlyFailed?: boolean;
  onlyUnrun?: boolean;
  skipPassingSince?: string;
  shuffle?: boolean;
  sample?: number;
  seed?: number;
  printIds?: boolean;
  printPassed?: boolean;
  printFailed?: boolean;
  outputRunIds?: string;
  showFailures?: boolean;
  configGrid?: boolean;
  githubStepSummary?: boolean;
  model?: string;
  provider?: string;
  temperature?: number;
  repeat?: number;
  maxSteps?: number;
  skipTags?: string[];
  name?: string;
  json?: boolean;
  stepTimeout?: number;
  configFilter?: string;
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
        console.log(`Loaded ${agentConfigs.length} agent config(s) from ${opts.configsDir}: ${agentConfigs.map(ac => ac.name).join(", ")}`);
      } else if (agentConfigs.length === 1) {
        console.log(`Config: ${agentConfigs[0]!.name} (model: ${agentConfigs[0]!.model ?? "?"})`);
      } else {
        console.log(`Loaded ${agentConfigs.length} agent config(s): ${agentConfigs.map(ac => ac.name).join(", ")}`);
      }
    }
  }

  if (opts.tags?.length && !suiteDir) {
    console.warn(`Warning: --tags has no effect without --suite (tags: ${opts.tags.join(", ")})`);
  }
  if (opts.skipTags?.length && !suiteDir) {
    console.warn(`Warning: --skip-tags has no effect without --suite (skip-tags: ${opts.skipTags.join(", ")})`);
  }

  let yamlFiles: string[];
  let testCases: TestCase[];

  if (suiteDir) {
    const allYamlFiles = findTestCaseYamlFiles(suiteDir);
    if (allYamlFiles.length === 0) {
      console.error(`No test cases found in suite directory: ${suiteDir}`);
      console.error(`Run \`agr list-tests ${relative(process.cwd(), suiteDir) || suiteDir}\` to debug.`);
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
        console.error(`Run \`agr list-tests ${relative(process.cwd(), suiteDir) || suiteDir}\` to see available tags.`);
        process.exit(1);
      }
      if (pairs.length < beforeCount) {
        console.log(
          `Tag filter [${opts.tags.join(", ")}]: ${pairs.length} of ${beforeCount} test case(s) matched`,
        );
      }
    }

    if (opts.skipTags?.length) {
      const skipSet = new Set(opts.skipTags);
      const beforeCount = pairs.length;
      pairs = pairs.filter(({ tc }) => !(tc.tags ?? []).some(t => skipSet.has(t)));
      if (pairs.length === 0) {
        console.error(`--skip-tags [${opts.skipTags.join(", ")}] excluded all test cases. Remove or adjust the filter.`);
        process.exit(1);
      }
      if (pairs.length < beforeCount) {
        console.log(`--skip-tags [${opts.skipTags.join(", ")}]: skipped ${beforeCount - pairs.length} test case(s), ${pairs.length} remaining`);
      }
    }

    if (opts.name) {
      const nameFilter = opts.name.toLowerCase();
      const beforeCount = pairs.length;
      pairs = pairs.filter(({ tc }) => tc.name.toLowerCase().includes(nameFilter));
      if (pairs.length === 0) {
        console.error(`--name "${opts.name}" matched no test cases in suite. Run \`agr list-tests ${relative(process.cwd(), suiteDir!) || suiteDir}\` to see available names.`);
        process.exit(1);
      }
      if (pairs.length < beforeCount) {
        console.log(`--name "${opts.name}": ${pairs.length} of ${beforeCount} test case(s) matched`);
      }
    }

    yamlFiles = pairs.map(p => p.yaml);
    testCases = pairs.map(p => p.tc);
  } else {
    yamlFiles = opts.testCaseArgs!.map(arg => resolveTestCasePath(arg));
    testCases = yamlFiles.map(f => loadTestCase(f));
    const tcLabel = testCases.length === 1 ? "test case" : "test cases";
    console.log(`Loaded ${testCases.length} ${tcLabel}: ${testCases.map(tc => tc.name).join(", ")}`);
  }

  if (opts.limit && opts.limit < testCases.length) {
    console.log(`--limit ${opts.limit}: running first ${opts.limit} of ${testCases.length} test case(s)`);
    testCases = testCases.slice(0, opts.limit);
    yamlFiles = yamlFiles.slice(0, opts.limit);
  }

  // seeded PRNG (mulberry32) — returns a deterministic sequence if seed is set
  let prngState = opts.seed ?? Math.floor(Math.random() * 2 ** 32);
  const prng = (): number => {
    prngState = (prngState + 0x6d2b79f5) >>> 0;
    let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };

  if (opts.shuffle && testCases.length > 1) {
    if (opts.seed !== undefined) console.log(`--seed ${opts.seed}: using deterministic shuffle`);
    const indices = testCases.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    testCases = indices.map((i) => testCases[i]!);
    yamlFiles = indices.map((i) => yamlFiles[i]!);
    console.log(`--shuffle: randomized order of ${testCases.length} test case(s)`);
  }

  if (opts.sample && opts.sample < testCases.length) {
    const n = opts.sample;
    if (opts.seed !== undefined) console.log(`--seed ${opts.seed}: using deterministic sample`);
    const indices = testCases.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    const picked = indices.slice(0, n);
    testCases = picked.map((i) => testCases[i]!);
    yamlFiles = picked.map((i) => yamlFiles[i]!);
    console.log(`--sample ${n}: randomly selected ${n} of ${indices.length} test case(s): ${testCases.map(tc => tc.name).join(", ")}`);
  }

  if (opts.onlyFailed) {
    const earlyDb = initDb();
    const allRuns = await listRuns(earlyDb);
    const failedIds = new Set<string>();
    const seenIds = new Set<string>();
    for (const run of allRuns) {
      if (!seenIds.has(run.testCaseId)) {
        seenIds.add(run.testCaseId);
        if (run.passed === false) failedIds.add(run.testCaseId);
      }
    }
    const beforeCount = testCases.length;
    const pairs = testCases.map((tc, i) => ({ tc, yaml: yamlFiles[i]! })).filter(({ tc }) => failedIds.has(tc.name));
    if (pairs.length === 0) {
      console.log(`--only-failed: no previously failed test cases found among [${testCases.map(tc => tc.name).join(", ")}].`);
      console.log("All test cases passed on their last run. Remove --only-failed to re-run everything.");
      process.exit(0);
    }
    testCases = pairs.map(p => p.tc);
    yamlFiles = pairs.map(p => p.yaml);
    console.log(`--only-failed: ${testCases.length} of ${beforeCount} test case(s) failed on last run: ${testCases.map(tc => tc.name).join(", ")}`);
  }

  if (opts.onlyUnrun) {
    const earlyDb = initDb();
    const allRuns = await listRuns(earlyDb);
    const runIds = new Set(allRuns.map((r) => r.testCaseId));
    const beforeCount = testCases.length;
    const pairs = testCases.map((tc, i) => ({ tc, yaml: yamlFiles[i]! })).filter(({ tc }) => !runIds.has(tc.name));
    if (pairs.length === 0) {
      console.log(`--only-unrun: all test cases have at least one recorded run. Nothing to run.`);
      console.log("Remove --only-unrun to re-run everything, or use --only-failed to re-run failures.");
      process.exit(0);
    }
    testCases = pairs.map(p => p.tc);
    yamlFiles = pairs.map(p => p.yaml);
    console.log(`--only-unrun: ${testCases.length} of ${beforeCount} test case(s) have no recorded runs: ${testCases.map(tc => tc.name).join(", ")}`);
  }

  if (opts.skipPassingSince) {
    const sinceTs = parseSince(opts.skipPassingSince);
    const earlyDb = initDb();
    const allRuns = await listRuns(earlyDb);
    const recentPassIds = new Set<string>();
    for (const run of allRuns) {
      if (run.passed === true && run.createdAt >= sinceTs) {
        recentPassIds.add(run.testCaseId);
      }
    }
    const beforeCount = testCases.length;
    const pairs = testCases.map((tc, i) => ({ tc, yaml: yamlFiles[i]! })).filter(({ tc }) => !recentPassIds.has(tc.name));
    const skipped = beforeCount - pairs.length;
    if (pairs.length === 0) {
      console.log(`--skip-passing-since ${opts.skipPassingSince}: all ${beforeCount} test case(s) have a passing run in the window. Nothing to run.`);
      process.exit(0);
    }
    testCases = pairs.map(p => p.tc);
    yamlFiles = pairs.map(p => p.yaml);
    if (skipped > 0) {
      console.log(`--skip-passing-since ${opts.skipPassingSince}: skipping ${skipped} test case(s) with recent passes, running ${testCases.length} of ${beforeCount}`);
    }
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

  if (opts.configFilter) {
    const cf = opts.configFilter.toLowerCase();
    const allNames = agentConfigs.map((ac) => ac.name);
    agentConfigs = agentConfigs.filter((ac) => ac.name.toLowerCase().includes(cf));
    if (agentConfigs.length === 0) {
      console.error(`--config-filter "${opts.configFilter}" matched no agent configs. Available: ${allNames.join(", ")}`);
      process.exit(1);
    }
    if (agentConfigs.length < allNames.length) {
      console.log(`--config-filter "${opts.configFilter}": ${agentConfigs.length} of ${allNames.length} config(s) matched: ${agentConfigs.map(ac => ac.name).join(", ")}`);
    }
  }

  if (opts.model) {
    const overrideModel = opts.model;
    console.log(`Overriding model for all agent config(s): ${overrideModel}`);
    agentConfigs = agentConfigs.map((ac) => ({ ...ac, model: overrideModel }));
  }

  if (opts.provider) {
    const overrideProvider = opts.provider;
    console.log(`Overriding provider for all agent config(s): ${overrideProvider}`);
    agentConfigs = agentConfigs.map((ac) => ({ ...ac, provider: overrideProvider }));
  }

  if (opts.temperature !== undefined) {
    const overrideTemp = opts.temperature;
    console.log(`Overriding temperature for all agent config(s): ${overrideTemp}`);
    agentConfigs = agentConfigs.map((ac) => ({ ...ac, temperature: overrideTemp }));
  }

  if (opts.maxSteps !== undefined) {
    const overrideSteps = opts.maxSteps;
    console.log(`Overriding max_steps for all agent config(s): ${overrideSteps}`);
    agentConfigs = agentConfigs.map((ac) => ({ ...ac, max_steps: overrideSteps, maxSteps: overrideSteps }));
  }

  if (opts.stepTimeout !== undefined) {
    const overrideTimeout = opts.stepTimeout;
    console.log(`Overriding step_timeout_ms for all agent config(s): ${overrideTimeout}`);
    agentConfigs = agentConfigs.map((ac) => ({ ...ac, step_timeout_ms: overrideTimeout }));
  }

  if (opts.repeat !== undefined && opts.repeat > 1) {
    const n = opts.repeat;
    const origTestCases = [...testCases];
    const origYamlFiles = [...yamlFiles];
    for (let i = 1; i < n; i++) {
      testCases = testCases.concat(origTestCases);
      yamlFiles = yamlFiles.concat(origYamlFiles);
    }
    if (!opts.json) console.log(`--repeat ${n}: running ${origTestCases.length} test case(s) x ${n} = ${testCases.length} total runs per config`);
  }

  if (opts.dryRun) {
    const cwd = process.cwd();
    const totalRuns = testCases.length * Math.max(agentConfigs.length, 1);
    const concurrency = opts.concurrency ?? 2;

    if (opts.json) {
      console.log(JSON.stringify({
        testCases: testCases.map((tc, i) => ({
          name: tc.name,
          path: relative(cwd, yamlFiles[i]!),
          tags: tc.tags ?? [],
        })),
        agentConfigs: agentConfigs.map((ac) => ({
          id: ac.id || ac.name,
          name: ac.name,
          model: ac.model ?? null,
        })),
        totalRuns,
        concurrency,
      }));
      return;
    }

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
    console.log(`Total: ${totalRuns} job(s)  concurrency: ${concurrency}`);
    // Estimate cost from historical data
    try {
      const earlyDb = initDb();
      const allRuns = await listRuns(earlyDb);
      const tcAvgCost = new Map<string, number>();
      const tcRunMap = new Map<string, number[]>();
      for (const r of allRuns) {
        if (!tcRunMap.has(r.testCaseId)) tcRunMap.set(r.testCaseId, []);
        tcRunMap.get(r.testCaseId)!.push(r.costUsd ?? 0);
      }
      for (const [tcId, costs] of tcRunMap) {
        tcAvgCost.set(tcId, costs.reduce((s, c) => s + c, 0) / costs.length);
      }
      const knownTcs = testCases.filter(tc => tcAvgCost.has(tc.name));
      if (knownTcs.length > 0) {
        const avgPerRun = knownTcs.reduce((s, tc) => s + (tcAvgCost.get(tc.name) ?? 0), 0) / knownTcs.length;
        const estimatedTotal = avgPerRun * totalRuns;
        console.log(`Estimated cost: ~$${estimatedTotal.toFixed(4)} (avg $${avgPerRun.toFixed(4)}/run based on ${knownTcs.length} of ${testCases.length} test case(s) with history)`);
      }
    } catch {
      // DB not available - skip cost estimate
    }
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
        console.error(`Toolkit security audit failed for ${toolkitPath}:`);
        for (const f of findings.filter(f => f.severity === "error")) {
          console.error(`  [FAIL] ${f.file}: ${f.message} (${f.rule})`);
        }
        console.error(`Run \`agr validate-toolkit ${toolkitPath}\` for the full report.`);
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

  // 5. render the live dashboard (or skip in --json mode)
  const totalRuns = testCases.length * Math.max(agentConfigs.length, 1);
  const runBreakdown = agentConfigs.length > 1
    ? `${testCases.length} test case(s) x ${agentConfigs.length} config(s) = ${totalRuns} run(s)`
    : `${totalRuns} run(s)`;
  if (!opts.json) console.log(`Starting ${runBreakdown}, concurrency: ${concurrency}`);
  const benchStartMs = Date.now();
  const runStates: Record<string, RunState> = {};
  const testCaseIds = testCases.map((tc) => tc.id || tc.name);
  const configIds = agentConfigs.map((ac) => ac.id || ac.name);

  let rerender: ((node: React.ReactNode) => void) | undefined;
  if (!opts.json) {
    const rendered = render(
      <Dashboard
        runs={runStates}
        testCases={testCaseIds}
        configs={configIds}
        isFinished={false}
      />
    );
    rerender = rendered.rerender;
  }

  const onRunUpdate = (run: any) => {
    const key = `${run.testCaseId}_${run.agentConfigId}`;
    runStates[key] = run;
    rerender?.(
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
    console.error("Comparison sweep runner encountered an error:", err);
  }

  // re-render one last time with isFinished so the dashboard shows the final state
  rerender?.(
    <Dashboard
      runs={runStates}
      testCases={testCaseIds}
      configs={configIds}
      isFinished={true}
    />
  );

  if (opts.json) {
    const allRuns = Object.values(runStates);
    const summary = summaryFromRunStates(runStates, configIds);
    const totalCostUsd = allRuns.reduce((acc, r) => acc + (r.costUsd || 0), 0);
    const elapsedMs = Date.now() - benchStartMs;
    const { exitCode, reasons } = evaluateBenchExit(summary, {
      failOnFailure: opts.failOnFailure,
      minSolveRate: opts.minSolveRate,
      minSolveRateScope: opts.minSolveRateScope,
    });
    console.log(JSON.stringify({
      passed: summary.passedRuns === summary.totalRuns && summary.totalRuns > 0,
      passedRuns: summary.passedRuns,
      totalRuns: summary.totalRuns,
      solveRate: summary.solveRate,
      totalCostUsd,
      elapsedMs,
      matrixId: matrixId ?? null,
      gateReasons: reasons,
      byConfig: Object.entries(summary.byConfig).map(([configId, stats]) => ({
        configId,
        passedRuns: stats.passedRuns,
        totalRuns: stats.totalRuns,
        solveRate: stats.solveRate,
        totalCostUsd: allRuns.filter(r => r.agentConfigId === configId).reduce((acc, r) => acc + (r.costUsd || 0), 0),
      })),
      runs: allRuns.map(r => ({
        runId: r.runId ?? null,
        testCaseId: r.testCaseId,
        agentConfigId: r.agentConfigId,
        passed: r.status === "completed" ? r.passed : null,
        costUsd: r.costUsd ?? 0,
        durationMs: r.durationMs ?? 0,
        stepsCount: r.stepsCount ?? 0,
        error: r.error ?? null,
      })),
    }));
    process.exit(exitCode);
  }

  printTagBreakdown(testCases, agentConfigs, runStates);

  await printToolUsageByConfig(db, agentConfigs, runStates);

  await printToolAdoptionByConfig(db, agentConfigs, runStates);

  if (matrixId) {
    await printMatrixSummary(db, matrixId, agentConfigs);
  }

  const summary = summaryFromRunStates(runStates, configIds);

  if (!matrixId) {
    const totalCost = Object.values(runStates).reduce((acc, r) => acc + (r.costUsd || 0), 0);
    const elapsedSec = ((Date.now() - benchStartMs) / 1000).toFixed(1);
    const configCount = Object.keys(summary.byConfig).length;
    if (configCount > 1) {
      const pct = summary.totalRuns > 0 ? ((summary.solveRate) * 100).toFixed(0) : "0";
      const avgCostNote = summary.totalRuns > 1 ? `  avg: $${(totalCost / summary.totalRuns).toFixed(4)}/run` : "";
      console.log(`\nResult: ${summary.passedRuns}/${summary.totalRuns} PASS (${pct}%)  cost: $${totalCost.toFixed(4)}${avgCostNote}  elapsed: ${elapsedSec}s`);
      const costByConfig = new Map<string, number>();
      for (const r of Object.values(runStates)) {
        costByConfig.set(r.agentConfigId, (costByConfig.get(r.agentConfigId) ?? 0) + (r.costUsd || 0));
      }
      const nameWidth = Math.max(...Object.keys(summary.byConfig).map(id => id.length));
      for (const [configId, stats] of Object.entries(summary.byConfig)) {
        const pct = stats.totalRuns > 0 ? ((stats.solveRate) * 100).toFixed(0) : "0";
        const cost = costByConfig.get(configId) ?? 0;
        const configRuns = Object.values(runStates).filter(r => r.agentConfigId === configId);
        const finishedRuns = configRuns.filter(r => r.status !== "running");
        const totalDurMs = finishedRuns.reduce((acc, r) => acc + (r.durationMs || 0), 0);
        const totalSteps = finishedRuns.reduce((acc, r) => acc + (r.stepsCount || 0), 0);
        const totalTokensIn = finishedRuns.reduce((acc, r) => acc + (r.tokensIn || 0), 0);
        const totalTokensOut = finishedRuns.reduce((acc, r) => acc + (r.tokensOut || 0), 0);
        const avgCostNote = stats.totalRuns > 1 ? `  avg: $${(cost / stats.totalRuns).toFixed(4)}/run` : "";
        const avgDurNote = finishedRuns.length > 1 ? `  avg: ${formatDuration(Math.round(totalDurMs / finishedRuns.length))}/run` : "";
        const avgStepsNote = finishedRuns.length > 1 ? `  avg: ${Math.round(totalSteps / finishedRuns.length)} steps/run` : "";
        const avgTokensNote = finishedRuns.length > 1 && (totalTokensIn > 0 || totalTokensOut > 0) ? `  avg: ${Math.round(totalTokensIn / finishedRuns.length)}in/${Math.round(totalTokensOut / finishedRuns.length)}out tok/run` : "";
        console.log(`  ${configId.padEnd(nameWidth)}  ${stats.passedRuns}/${stats.totalRuns} PASS (${pct}%)  $${cost.toFixed(4)}${avgCostNote}${avgDurNote}${avgStepsNote}${avgTokensNote}`);
        const failedCases = configRuns.filter(r => r.status === "completed" && !r.passed).map(r => r.testCaseId);
        const erroredRuns = configRuns.filter(r => r.status === "failed");
        if (failedCases.length > 10) {
          console.log(`  ${" ".repeat(nameWidth)}  Failed: ${failedCases.length} cases (see \`agr list\`)`);
        } else if (failedCases.length > 0) {
          console.log(`  ${" ".repeat(nameWidth)}  Failed: ${failedCases.join(", ")}`);
        }
        if (erroredRuns.length > 10) {
          console.log(`  ${" ".repeat(nameWidth)}  Errored: ${erroredRuns.length} cases`);
        } else if (erroredRuns.length > 0) {
          const crashedList = erroredRuns.map(r => r.error ? `${r.testCaseId} (${r.error.slice(0, 60)})` : r.testCaseId).join(", ");
          console.log(`  ${" ".repeat(nameWidth)}  Errored: ${crashedList}`);
        }
      }
    } else {
      const pct = summary.totalRuns > 0 ? ((summary.solveRate) * 100).toFixed(0) : "0";
      const allFinished = Object.values(runStates).filter(r => r.status !== "running");
      const totalDurMs = allFinished.reduce((acc, r) => acc + (r.durationMs || 0), 0);
      const totalSteps = allFinished.reduce((acc, r) => acc + (r.stepsCount || 0), 0);
      const totalTokensIn = allFinished.reduce((acc, r) => acc + (r.tokensIn || 0), 0);
      const totalTokensOut = allFinished.reduce((acc, r) => acc + (r.tokensOut || 0), 0);
      const avgCostNote = summary.totalRuns > 1 ? `  avg: $${(totalCost / summary.totalRuns).toFixed(4)}/run` : "";
      const avgDurNote = allFinished.length > 1 ? `  avg: ${formatDuration(Math.round(totalDurMs / allFinished.length))}/run` : "";
      const avgStepsNote = allFinished.length > 1 ? `  avg: ${Math.round(totalSteps / allFinished.length)} steps/run` : "";
      const avgTokensNote = allFinished.length > 1 && (totalTokensIn > 0 || totalTokensOut > 0) ? `  avg: ${Math.round(totalTokensIn / allFinished.length)}in/${Math.round(totalTokensOut / allFinished.length)}out tok/run` : "";
      console.log(`\nResult: ${summary.passedRuns}/${summary.totalRuns} PASS (${pct}%)  cost: $${totalCost.toFixed(4)}${avgCostNote}${avgDurNote}${avgStepsNote}${avgTokensNote}  elapsed: ${elapsedSec}s`);
      const crashedRuns = Object.values(runStates).filter(r => r.status === "failed");
      const testFailedCases = Object.values(runStates).filter(r => r.status === "completed" && !r.passed).map(r => r.testCaseId);
      if (testFailedCases.length > 10) {
        console.log(`  Failed: ${testFailedCases.length} cases (see \`agr list\`)`);
      } else if (testFailedCases.length > 0) {
        console.log(`  Failed: ${testFailedCases.join(", ")}`);
      }
      if (crashedRuns.length > 10) {
        console.log(`  Errored: ${crashedRuns.length} cases`);
      } else if (crashedRuns.length > 0) {
        const crashedList = crashedRuns.map(r => r.error ? `${r.testCaseId} (${r.error.slice(0, 60)})` : r.testCaseId).join(", ");
        console.log(`  Errored: ${crashedList}`);
      }
    }
  }

  if (opts.report && !opts.output && !opts.reportDir) {
    console.warn(`Warning: --report ${opts.report} has no effect without --output <path> or --report-dir <dir>.`);
  }

  if (opts.report && (opts.output || opts.reportDir)) {
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
    const outputPath = opts.output ?? buildTimestampedReportPath(opts.reportDir!, opts.report);
    const path = writeReport(report, opts.report, outputPath);
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

  if (opts.printIds && runIdsForExport.length > 0) {
    console.log("\nRun IDs:");
    for (const id of runIdsForExport) {
      console.log(id);
    }
  }

  if (opts.printPassed) {
    const passedIds = Object.values(runStates).filter(r => r.status === "completed" && r.passed).map(r => r.runId);
    if (passedIds.length > 0) {
      if (!opts.json) console.log(`\nPassing run IDs (${passedIds.length}):`);
      for (const id of passedIds) console.log(id);
    }
  }

  if (opts.printFailed) {
    const failedIds = Object.values(runStates).filter(r => r.status === "failed" || (r.status === "completed" && !r.passed)).map(r => r.runId);
    if (failedIds.length > 0) {
      if (!opts.json) console.log(`\nFailing run IDs (${failedIds.length}):`);
      for (const id of failedIds) console.log(id);
    }
  }

  if (opts.outputRunIds && runIdsForExport.length > 0) {
    const { writeFileSync } = await import("node:fs");
    const { resolve: resolvePath } = await import("node:path");
    const outPath = resolvePath(opts.outputRunIds);
    writeFileSync(outPath, runIdsForExport.join("\n") + "\n", "utf-8");
    console.log(`Run IDs written to ${outPath} (${runIdsForExport.length} run(s))`);
  }

  if (opts.showFailures) {
    const failedStates = Object.values(runStates).filter((r) => r.status === "failed" || (r.status === "completed" && !r.passed));
    if (failedStates.length > 0) {
      console.log(`\nFailed test cases (${failedStates.length}):`);
      for (const r of failedStates) {
        const idNote = r.runId ? `  [agr trace ${r.runId}]` : "";
        const errNote = r.error ? `  -- ${r.error.slice(0, 80)}` : "";
        console.log(`  ${r.testCaseId}${idNote}${errNote}`);
      }
    }
  }

  if (opts.githubStepSummary) {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryFile) {
      if (opts.githubStepSummary) console.warn("[warn] --github-step-summary: GITHUB_STEP_SUMMARY env var not set; skipping.");
    } else {
      const totalCostForSummary = Object.values(runStates).reduce((acc, r) => acc + (r.costUsd || 0), 0);
      const pct = summary.totalRuns > 0 ? ((summary.solveRate) * 100).toFixed(0) : "0";
      const statusEmoji = summary.passedRuns === summary.totalRuns ? "✅" : summary.passedRuns === 0 ? "❌" : "⚠️";
      let md = `\n## ${statusEmoji} Bench: ${summary.passedRuns}/${summary.totalRuns} PASS (${pct}%)\n\n`;
      md += `**Cost:** $${totalCostForSummary.toFixed(4)} total`;
      if (summary.totalRuns > 1) md += `  avg: $${(totalCostForSummary / summary.totalRuns).toFixed(4)}/run`;
      md += `\n\n`;
      if (agentConfigs.length > 1) {
        md += `| Config | Pass | Total | Solve Rate |\n|---|---|---|---|\n`;
        for (const cfg of agentConfigs) {
          const cfgId = cfg.id || cfg.name;
          const cfgRuns = Object.values(runStates).filter(r => r.agentConfigId === cfgId);
          const cfgPassed = cfgRuns.filter(r => r.passed).length;
          const cfgPct = cfgRuns.length > 0 ? ((cfgPassed / cfgRuns.length) * 100).toFixed(0) : "0";
          md += `| ${cfgId} | ${cfgPassed} | ${cfgRuns.length} | ${cfgPct}% |\n`;
        }
        md += "\n";
      }
      appendFileSync(summaryFile, md, "utf-8");
      console.log(`GitHub step summary written to ${summaryFile}`);
    }
  }

  if (opts.configGrid && agentConfigs.length > 1) {
    const states = Object.values(runStates);
    const tcIds = [...new Set(states.map((r) => r.testCaseId))].sort();
    const cfgIds = agentConfigs.map((c) => c.id || c.name);
    const resultMap = new Map<string, boolean | null>();
    for (const r of states) {
      resultMap.set(`${r.testCaseId}::${r.agentConfigId}`, r.status === "completed" ? r.passed : null);
    }
    const tcWidth = Math.max(...tcIds.map((tc) => tc.length), 12);
    const cfgWidth = Math.max(...cfgIds.map((c) => Math.min(c.length, 16)), 6);
    console.log("\nConfig grid (current bench):\n");
    console.log("".padEnd(tcWidth + 2) + cfgIds.map((c) => c.slice(0, cfgWidth).padEnd(cfgWidth + 2)).join(""));
    for (const tc of tcIds) {
      const cells = cfgIds.map((cfg) => {
        const r = resultMap.get(`${tc}::${cfg}`);
        const label = r === true ? "PASS" : r === false ? "FAIL" : "--  ";
        return label.padEnd(cfgWidth + 2);
      }).join("");
      console.log(`${tc.padEnd(tcWidth + 2)}${cells}`);
    }
  }

  const { exitCode, reasons } = evaluateBenchExit(summary, {
    failOnFailure: opts.failOnFailure,
    minSolveRate: opts.minSolveRate,
    minSolveRateScope: opts.minSolveRateScope,
  });

  if (reasons.length > 0) {
    console.error("\n[FAIL] Comparison sweep gate failed:");
    for (const reason of reasons) {
      console.error(`  - ${reason}`);
    }
  }

  let nextHint: string;
  const gateTriggered = reasons.length > 0;
  const needsDebug = gateTriggered || (summary.totalRuns > 0 && summary.passedRuns === 0);
  if (opts.saveBaseline) {
    nextHint = `Baseline saved to ${opts.saveBaseline}. On a PR branch: agr bench ... && agr compare-baseline --current ${opts.saveBaseline} --format md --output comment.md --fail-on-regression`;
  } else if (matrixId) {
    nextHint = `Next: agr export runs --last-matrix --format jsonl --output sweep.jsonl  |  agr list`;
  } else if (needsDebug) {
    if (agentConfigs.length > 1) {
      nextHint = `Inspect: agr compare --last-two --only-diff  |  agr trace --last --quality  |  agr list`;
    } else {
      nextHint = `Inspect: agr trace --last  |  agr trace --last --quality  |  agr trace --last --tools`;
    }
  } else if (agentConfigs.length > 1) {
    nextHint = `Next: agr compare --last-two --only-diff  |  agr list  |  agr export runs --format jsonl --output runs.jsonl`;
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
  const includesTokens = aggregates.some((a) => (a.avgTokensIn ?? 0) > 0 || (a.avgTokensOut ?? 0) > 0);

  console.log("\n================ MATRIX SUMMARY ================");
  for (const agg of aggregates) {
    const marker = frontIds.has(agg.agentConfigId) ? "*" : " ";
    const solveRatePct = (agg.solveRate * 100).toFixed(0);
    const lint =
      agg.avgQuality?.linterViolations !== undefined
        ? ` lint:${agg.avgQuality.linterViolations.toFixed(1)}`
        : "";
    const tok = includesTokens
      ? ` tok:${Math.round(agg.avgTokensIn ?? 0)}/${Math.round(agg.avgTokensOut ?? 0)}`
      : "";
    console.log(
      `${marker} ${agg.agentConfigName.padEnd(36)} solve:${solveRatePct.padStart(3)}% (${agg.passedRuns}/${agg.totalRuns}) cost:$${agg.avgCostUsd.toFixed(4)}${tok}${lint}`,
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
    const note = passed === total ? "  all passed" : passed === 0 ? "  none passed" : "";
    console.log(`${tag.padEnd(24)} ${passed}/${total} (${pct}%)${note}`);
  }
  console.log("=================================================\n");
}
