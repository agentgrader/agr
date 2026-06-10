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

  // SWE-bench based fields (all optional, backwards compatible)
  tags: z.array(z.string()).optional(),

  // shell command used to run the test suite (TAP output expected for node:test)
  test_command: z.string().optional(),

  // names of tests that must flip from failing -> passing (FAIL_TO_PASS)
  fail_to_pass: z.array(z.string()).optional(),

  // names of tests that must remain passing throughout (PASS_TO_PASS)
  pass_to_pass: z.array(z.string()).optional(),

  // glob patterns of files the agent must NOT modify (e.g. test files - tamper guard)
  forbid_modified: z.array(z.string()).optional(),

  // glob patterns of files the agent is expected to touch (for localization scoring)
  expected_files: z.array(z.string()).optional(),

  // path (relative to the crucible.yaml) to a gold-standard patch/diff for this task
  solution: z.string().optional(),

  // path (relative to the crucible.yaml) to a patch that adds/updates the test suite itself
  test_patch: z.string().optional(),

  // original creation date of the underlying issue/PR (contamination/date-cutoff checks)
  created_at: z.string().optional(),

  // custom Docker image to run the sandbox from (defaults to the provider's default)
  image: z.string().optional(),

  // paths to toolkit directories (custom CLI tools + .claude/skills/) to
  // inject into the sandbox and surface to the agent via the system prompt,
  // in addition to any toolkits configured on the agent
  toolkits: z.array(z.string()).optional(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;
