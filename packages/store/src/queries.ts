import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";
import { eq, desc } from "drizzle-orm";

export type CrucibleDb = ReturnType<typeof initDb>;

export function initDb(dbPath: string = ".crucible/db.sqlite") {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });
  
  // create tables on first run
  sqlite.run(`
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

  sqlite.run(`
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

  sqlite.run(`
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

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      kind TEXT NOT NULL,
      tool TEXT,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      content TEXT,
      FOREIGN KEY(run_id) REFERENCES runs(id)
    )
  `);

  return db;
}

// query helpers
export async function saveTestCase(db: CrucibleDb, testCase: typeof schema.testCases.$inferInsert) {
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
      },
    });
}

export async function saveAgentConfig(db: CrucibleDb, config: typeof schema.agentConfigs.$inferInsert) {
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

export async function createRun(db: CrucibleDb, run: typeof schema.runs.$inferInsert) {
  await db.insert(schema.runs).values(run);
}

export async function updateRun(
  db: CrucibleDb,
  runId: string,
  updates: Partial<Omit<typeof schema.runs.$inferInsert, "id">>
) {
  await db.update(schema.runs).set(updates).where(eq(schema.runs.id, runId));
}

export async function addTrace(db: CrucibleDb, trace: typeof schema.traces.$inferInsert) {
  await db.insert(schema.traces).values(trace);
}

export async function getRun(db: CrucibleDb, runId: string) {
  const result = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
    .limit(1);
  return result[0] || null;
}

export async function getTraces(db: CrucibleDb, runId: string) {
  return db
    .select()
    .from(schema.traces)
    .where(eq(schema.traces.runId, runId))
    .orderBy(schema.traces.stepIndex);
}

export async function getRunsForTestCase(db: CrucibleDb, testCaseId: string) {
  return db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.testCaseId, testCaseId))
    .orderBy(desc(schema.runs.createdAt));
}

export async function listRuns(db: CrucibleDb) {
  return db
    .select()
    .from(schema.runs)
    .orderBy(desc(schema.runs.createdAt));
}
