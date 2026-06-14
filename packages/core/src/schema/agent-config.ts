import { z } from "zod";
import { McpServerConfigSchema } from "./toolkit";

export const AgentConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  model: z.string(),
  provider: z.string().optional(),
  max_steps: z.number().default(30),
  temperature: z.number().optional(),
  step_timeout_ms: z
    .number()
    .default(120_000)
    .describe(
      "Abort the agent's generateText call if a single provider request hangs longer than this. Without a timeout, a stalled API request leaves the run (and its sandbox container) hanging indefinitely with no error, no result, and no cleanup.",
    ),
  system_prompt: z.string().optional(),
  tools: z
    .array(z.string())
    .optional()
    .describe(
      "Optional allowlist of tool names (local: executeCommand, readFile, writeFile, submit; MCP: <mcpServerName>_<toolName>). submit is always included implicitly.",
    ),

  // paths to toolkit directories (custom CLI tools + .claude/skills/) to
  // inject into the sandbox and surface to the agent via the system prompt
  toolkits: z.array(z.string()).optional(),

  require_tools_before_submit: z
    .array(z.string())
    .optional()
    .describe(
      "Command names (e.g. a toolkit's run-tests, or a generic pytest/biome) that should have been invoked at least once before submit. Checked against executeCommand/terminal/create first-words and direct tool names - never blocks the run, just annotates metrics['tool-adoption'] for agr trace/bench.",
    ),

  track_tools: z
    .array(z.string())
    .optional()
    .describe(
      "Optional toolkit command names to track usage of for analytics only (e.g. a toolkit's optional tools like find-usages or show-call-hierarchy). Same detection as require_tools_before_submit, but purely informational - annotates metrics['tool-usage'] with which tracked tools were/weren't used, without affecting metrics['tool-adoption'] or pass/fail.",
    ),

  // MCP servers to connect to and expose as additional tools, keyed by name
  mcp_servers: z.record(McpServerConfigSchema).optional(),

  // model escalation: after this many steps without a `submit` call, switch
  // to `escalate_model` for the remaining steps (e.g. start on a cheap model
  // and fall back to a stronger one if the cheap model is struggling). Only
  // takes effect when both fields are set.
  escalate_after_steps: z.number().optional(),
  escalate_model: z.string().optional(),

  acp_command: z
    .string()
    .optional()
    .describe(
      "Executable for an ACP-compatible agent (e.g. cursor-agent or claude). Used by @agentgrader/agent-acp.",
    ),
  acp_args: z
    .array(z.string())
    .optional()
    .describe("Arguments passed to acp_command (e.g. [\"acp\"] or [\"--acp\"])."),
  acp_cwd: z
    .string()
    .optional()
    .describe("Session working directory forwarded to the ACP agent (defaults to /app in sandboxes)."),
  acp_env: z
    .record(z.string())
    .optional()
    .describe("Extra environment variables for the spawned ACP agent subprocess."),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
