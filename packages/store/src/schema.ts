import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const testCases = sqliteTable("test_cases", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fixture: text("fixture").notNull(),
  prompt: text("prompt").notNull(),
  success: text("success").notNull(), // json array of SuccessCriterion
  timeoutSeconds: integer("timeout_seconds").notNull(),
  createdAt: integer("created_at").notNull(),

  // SWE-bench inspired fields (all optional, JSON-encoded where arrays)
  tags: text("tags"), // json array of strings
  testCommand: text("test_command"),
  failToPass: text("fail_to_pass"), // json array of strings
  passToPass: text("pass_to_pass"), // json array of strings
  forbidModified: text("forbid_modified"), // json array of glob patterns
  expectedFiles: text("expected_files"), // json array of glob patterns
  solution: text("solution"), // path or raw diff for the gold patch
  testPatch: text("test_patch"), // path or raw diff that adds/updates tests
  sourceCreatedAt: text("source_created_at"), // original issue/PR creation date
});

export const agentConfigs = sqliteTable("agent_configs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  model: text("model").notNull(),
  maxSteps: integer("max_steps").notNull(),
  temperature: real("temperature"),
  systemPrompt: text("system_prompt"),
  tools: text("tools"), // json array of tool configs (optional)
  createdAt: integer("created_at").notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  testCaseId: text("test_case_id")
    .notNull()
    .references(() => testCases.id),
  agentConfigId: text("agent_config_id")
    .notNull()
    .references(() => agentConfigs.id),
  sandboxProvider: text("sandbox_provider").notNull(),
  status: text("status").notNull(), // 'running' | 'completed' | 'failed'
  passed: integer("passed", { mode: "boolean" }),
  score: real("score"),
  stepsCount: integer("steps_count").notNull().default(0),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error"),
  finalDiff: text("final_diff"),
  metrics: text("metrics"), // json object: regression/diff/localization scores etc.
  matrixId: text("matrix_id"), // optimizer matrix run this config belongs to, if any
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
});

// Caches the pre-patch (baseline) test status map for a given fixture +
// test command, so `runSingle` doesn't have to re-run the full suite on a
// pristine sandbox for every run of the same test case.
export const testCaseBaselines = sqliteTable("test_case_baselines", {
  id: text("id").primaryKey(), // `${testCaseId}:${fixtureHash}`
  testCaseId: text("test_case_id").notNull(),
  fixtureHash: text("fixture_hash").notNull(),
  testCommand: text("test_command").notNull(),
  statusMap: text("status_map").notNull(), // json TestStatusMap
  createdAt: integer("created_at").notNull(),
});

export const traces = sqliteTable("traces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  stepIndex: integer("step_index").notNull(),
  kind: text("kind").notNull(), // 'tool_call' | 'tool_result' | 'message'
  tool: text("tool"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  timestamp: integer("timestamp").notNull(),
  content: text("content"), // raw text, tool args, or tool result
});
