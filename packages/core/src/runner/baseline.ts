import type { CrucibleDb } from "@crucible-agr/store";
import { getCachedBaseline, saveCachedBaseline } from "@crucible-agr/store";
import type { SandboxProvider } from "../adapters/sandbox-provider";
import type { TestStatusMap } from "../adapters/test-result-parser";
import { TapTestResultParser } from "../adapters/test-result-parser";
import type { TestCase } from "../schema/test-case";
import { hashFixture } from "./fixture-hash";

export interface BaselineResult {
  fixtureHash: string;
  statusMap: TestStatusMap;
  /** true if this baseline came from the cache rather than a fresh run */
  cached: boolean;
}

/**
 * Computes (or loads from cache) the pre-patch test status map for a test
 * case's fixture. Used by RegressionScorer so PASS_TO_PASS tests that were
 * already broken before the agent touched anything don't unfairly penalize
 * the run.
 *
 * Returns `undefined` if the test case has no `test_command` configured -
 * baseline computation is then skipped entirely.
 */
export async function getOrComputeBaseline(input: {
  testCase: TestCase;
  sandboxProvider: SandboxProvider;
  db?: CrucibleDb;
}): Promise<BaselineResult | undefined> {
  const { testCase, sandboxProvider, db } = input;
  if (!testCase.test_command) return undefined;

  const testCaseId = testCase.id || testCase.name;
  const fixtureHash = hashFixture(testCase.fixture);

  if (db) {
    try {
      const cached = await getCachedBaseline(db, testCaseId, fixtureHash);
      if (cached && cached.testCommand === testCase.test_command) {
        return {
          fixtureHash,
          statusMap: JSON.parse(cached.statusMap) as TestStatusMap,
          cached: true,
        };
      }
    } catch (err: any) {
      console.error(`Failed to read cached baseline: ${err.message}`);
    }
  }

  // run the pristine fixture's test suite once to determine the baseline
  // pass/fail status of every test.
  const sandbox = await sandboxProvider.create({ gitSnapshot: testCase.fixture });
  let statusMap: TestStatusMap = {};
  try {
    const res = await sandbox.exec(testCase.test_command);
    statusMap = new TapTestResultParser().parse(`${res.stdout}\n${res.stderr}`);
  } finally {
    await sandbox.destroy();
  }

  if (db) {
    try {
      await saveCachedBaseline(db, {
        id: `${testCaseId}:${fixtureHash}`,
        testCaseId,
        fixtureHash,
        testCommand: testCase.test_command,
        statusMap: JSON.stringify(statusMap),
        createdAt: Math.floor(Date.now() / 1000),
      });
    } catch (err: any) {
      console.error(`Failed to persist baseline cache: ${err.message}`);
    }
  }

  return { fixtureHash, statusMap, cached: false };
}
