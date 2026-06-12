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

  // MCP servers to connect to and expose as additional tools, keyed by name
  mcp_servers: z.record(McpServerConfigSchema).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
