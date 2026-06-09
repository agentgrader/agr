import { z } from "zod";

export const SuccessCriterionSchema = z.union([
  z.object({
    run: z.string(),
    expect: z.object({
      exit_code: z.number().default(0),
    }),
  }),
  z.object({
    assert: z.string(),
  }),
]);

export type SuccessCriterion = z.infer<typeof SuccessCriterionSchema>;

export const TestCaseSchema = z.object({
  id: z.string().optional(), // Can be inferred from file name/folder if omitted
  name: z.string(),
  description: z.string().optional(),
  fixture: z.string(),
  prompt: z.string(),
  success: z.array(SuccessCriterionSchema),
  timeout_seconds: z.number().default(300),
});

export type TestCase = z.infer<typeof TestCaseSchema>;
