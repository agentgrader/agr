import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type AgrDb = ReturnType<typeof initDb>;

export function initDb(dbPath = ".agr/db.sqlite") {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });

  // create tables on first run
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      fixture TEXT NOT NULL,
      prompt TEXT NOT NULL,
      success TEXT NOT NULL,
      timeout_seconds INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      max_steps INTEGER NOT NULL,
      temperature REAL,
      system_prompt TEXT,
      tools TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      test_case_id TEXT NOT NULL,
      agent_config_id TEXT NOT NULL,
      sandbox_provider TEXT NOT NULL,
      status TEXT NOT NULL,
      passed INTEGER,
      score REAL,
      steps_count INTEGER NOT NULL DEFAULT 0,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      final_diff TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY(test_case_id) REFERENCES test_cases(id),
      FOREIGN KEY(agent_config_id) REFERENCES agent_configs(id)
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      kind TEXT NOT NULL,
      tool TEXT,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      cached_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      content TEXT,
      FOREIGN KEY(run_id) REFERENCES runs(id)
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS test_case_baselines (
      id TEXT PRIMARY KEY,
      test_case_id TEXT NOT NULL,
      fixture_hash TEXT NOT NULL,
      test_command TEXT NOT NULL,
      status_map TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // lightweight migrations: add SWE-bench-inspired columns to pre-existing
  // databases that were created before these fields existed.
  ensureColumn(sqlite, "test_cases", "tags", "TEXT");
  ensureColumn(sqlite, "test_cases", "test_command", "TEXT");
  ensureColumn(sqlite, "test_cases", "fail_to_pass", "TEXT");
  ensureColumn(sqlite, "test_cases", "pass_to_pass", "TEXT");
  ensureColumn(sqlite, "test_cases", "forbid_modified", "TEXT");
  ensureColumn(sqlite, "test_cases", "expected_files", "TEXT");
  ensureColumn(sqlite, "test_cases", "solution", "TEXT");
  ensureColumn(sqlite, "test_cases", "test_patch", "TEXT");
  ensureColumn(sqlite, "test_cases", "source_created_at", "TEXT");
  ensureColumn(sqlite, "runs", "metrics", "TEXT");
  ensureColumn(sqlite, "runs", "matrix_id", "TEXT");
  ensureColumn(sqlite, "traces", "cached_tokens", "INTEGER NOT NULL DEFAULT 0");

  return db;
}

function ensureColumn(
  sqlite: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// query helpers
export async function saveTestCase(db: AgrDb, testCase: typeof schema.testCases.$inferInsert) {
  await db
    .insert(schema.testCases)
    .values(testCase)
    .onConflictDoUpdate({
      target: schema.testCases.id,
      set: {
        name: testCase.name,
        description: testCase.description,
        fixture: testCase.fixture,
        prompt: testCase.prompt,
        success: testCase.success,
        timeoutSeconds: testCase.timeoutSeconds,
        tags: testCase.tags,
        testCommand: testCase.testCommand,
        failToPass: testCase.failToPass,
        passToPass: testCase.passToPass,
        forbidModified: testCase.forbidModified,
        expectedFiles: testCase.expectedFiles,
        solution: testCase.solution,
        testPatch: testCase.testPatch,
        sourceCreatedAt: testCase.sourceCreatedAt,
      },
    });
}

export async function saveAgentConfig(
  db: AgrDb,
  config: typeof schema.agentConfigs.$inferInsert,
) {
  await db
    .insert(schema.agentConfigs)
    .values(config)
    .onConflictDoUpdate({
      target: schema.agentConfigs.id,
      set: {
        name: config.name,
        model: config.model,
        maxSteps: config.maxSteps,
        temperature: config.temperature,
        systemPrompt: config.systemPrompt,
        tools: config.tools,
      },
    });
}

export async function createRun(db: AgrDb, run: typeof schema.runs.$inferInsert) {
  await db.insert(schema.runs).values(run);
}

export async function updateRun(
  db: AgrDb,
  runId: string,
  updates: Partial<Omit<typeof schema.runs.$inferInsert, "id">>,
) {
  await db.update(schema.runs).set(updates).where(eq(schema.runs.id, runId));
}

export async function addTrace(db: AgrDb, trace: typeof schema.traces.$inferInsert) {
  await db.insert(schema.traces).values(trace);
}

export async function getRun(db: AgrDb, runId: string) {
  const result = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
  return result[0] || null;
}

export async function getTraces(db: AgrDb, runId: string) {
  return db
    .select()
    .from(schema.traces)
    .where(eq(schema.traces.runId, runId))
    .orderBy(schema.traces.stepIndex);
}

export async function getRunsForTestCase(db: AgrDb, testCaseId: string) {
  return db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.testCaseId, testCaseId))
    .orderBy(desc(schema.runs.createdAt));
}

export async function listRuns(db: AgrDb) {
  return db.select().from(schema.runs).orderBy(desc(schema.runs.createdAt));
}

export async function getRunsByMatrixId(db: AgrDb, matrixId: string) {
  return db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.matrixId, matrixId))
    .orderBy(desc(schema.runs.createdAt));
}

export async function getCachedBaseline(db: AgrDb, testCaseId: string, fixtureHash: string) {
  const id = `${testCaseId}:${fixtureHash}`;
  const result = await db
    .select()
    .from(schema.testCaseBaselines)
    .where(eq(schema.testCaseBaselines.id, id))
    .limit(1);
  return result[0] || null;
}

export async function saveCachedBaseline(
  db: AgrDb,
  baseline: typeof schema.testCaseBaselines.$inferInsert,
) {
  await db
    .insert(schema.testCaseBaselines)
    .values(baseline)
    .onConflictDoUpdate({
      target: schema.testCaseBaselines.id,
      set: {
        statusMap: baseline.statusMap,
        testCommand: baseline.testCommand,
        createdAt: baseline.createdAt,
      },
    });
}
