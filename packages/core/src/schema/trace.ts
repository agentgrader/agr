import { z } from "zod";

export const StepEventSchema = z.object({
  index: z.number(),
  kind: z.enum(["tool_call", "tool_result", "message", "thinking"]),
  tool: z.string().optional(),
  tokensIn: z.number().default(0),
  tokensOut: z.number().default(0),
  // tokens served from the provider's prompt cache (subset of tokensIn),
  // billed at a discount. 0 for providers/models without cache support.
  cachedTokens: z.number().default(0),
  costUsd: z.number().default(0),
  timestamp: z.number(),
  content: z.string().optional(),
});

export type StepEvent = z.infer<typeof StepEventSchema>;

export const TraceSchema = z.object({
  runId: z.string(),
  steps: z.array(StepEventSchema),
});

export type Trace = z.infer<typeof TraceSchema>;
