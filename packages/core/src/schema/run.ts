import { z } from "zod";

export const RunSchema = z.object({
  id: z.string(),
  testCaseId: z.string(),
  agentConfigId: z.string(),
  sandboxProvider: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  passed: z.boolean().optional(),
  score: z.number().optional(),
  stepsCount: z.number().default(0),
  tokensIn: z.number().default(0),
  tokensOut: z.number().default(0),
  costUsd: z.number().default(0),
  durationMs: z.number().default(0),
  error: z.string().optional(),
  finalDiff: z.string().optional(),
  // extended scoring metrics: regression (FAIL_TO_PASS/PASS_TO_PASS), diff stats,
  // localization precision/recall, etc. Stored as JSON.
  metrics: z.record(z.any()).optional(),
  createdAt: z.number(),
  completedAt: z.number().optional(),
});

export type Run = z.infer<typeof RunSchema>;
