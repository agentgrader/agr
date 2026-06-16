import { agentConfigs, testCases, type AgrDb, listRuns } from "@agentgrader/store";

export interface EnrichedRun {
  id: string;
  testCaseId: string;
  testCaseName: string;
  agentConfigId: string;
  agentConfigName: string;
  agentModel: string;
  sandboxProvider: string;
  status: string;
  passed: boolean | null;
  stepsCount: number;
  costUsd: number;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
  finalDiff: string | null;
  matrixId: string | null;
  createdAt: number;
  completedAt: number | null;
}

export async function loadEnrichedRuns(db: AgrDb, limit?: number, sinceTs?: number, testCaseFilter?: string, configFilter?: string, passedFilter?: boolean): Promise<EnrichedRun[]> {
  const rows = await listRuns(db);
  const filtered = sinceTs !== undefined ? rows.filter((r) => r.createdAt >= sinceTs) : rows;
  const tcFiltered = testCaseFilter
    ? filtered.filter((r) => r.testCaseId === testCaseFilter || r.testCaseId.includes(testCaseFilter))
    : filtered;
  const cfgFiltered = configFilter
    ? tcFiltered.filter((r) => r.agentConfigId === configFilter || r.agentConfigId.includes(configFilter))
    : tcFiltered;
  const passedFiltered = passedFilter !== undefined
    ? cfgFiltered.filter((r) => r.passed === passedFilter)
    : cfgFiltered;
  const limited = limit ? passedFiltered.slice(0, limit) : passedFiltered;
  if (limited.length === 0) return [];

  const [tcRows, cfgRows] = await Promise.all([
    db.select().from(testCases),
    db.select().from(agentConfigs),
  ]);

  const tcById = new Map(tcRows.map((r) => [r.id, r]));
  const cfgById = new Map(cfgRows.map((r) => [r.id, r]));

  return limited.map((run) => {
    const tc = tcById.get(run.testCaseId);
    const cfg = cfgById.get(run.agentConfigId);
    return {
      id: run.id,
      testCaseId: run.testCaseId,
      testCaseName: tc?.name ?? run.testCaseId,
      agentConfigId: run.agentConfigId,
      agentConfigName: cfg?.name ?? run.agentConfigId,
      agentModel: cfg?.model ?? "unknown",
      sandboxProvider: run.sandboxProvider,
      status: run.status,
      passed: run.passed ?? null,
      stepsCount: run.stepsCount,
      costUsd: run.costUsd,
      durationMs: run.durationMs,
      tokensIn: run.tokensIn ?? 0,
      tokensOut: run.tokensOut ?? 0,
      error: run.error ?? null,
      finalDiff: run.finalDiff ?? null,
      matrixId: run.matrixId ?? null,
      createdAt: run.createdAt,
      completedAt: run.completedAt ?? null,
    };
  });
}

export function shortRunId(id: string): string {
  return id.slice(0, 8);
}

export function formatRunStatus(run: Pick<EnrichedRun, "status" | "passed">): string {
  if (run.passed === true) return "PASS";
  if (run.passed === false) return "FAIL";
  if (run.status === "running") return "RUNNING";
  if (run.status === "failed") return "ERROR";
  return run.status.toUpperCase();
}
