import { z } from "zod";
import { McpServerConfigSchema } from "./toolkit";

export const AgentConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  model: z.string(),
  max_steps: z.number().default(30),
  temperature: z.number().optional(),
  system_prompt: z.string().optional(),
  tools: z.array(z.string()).optional(),

  // paths to toolkit directories (custom CLI tools + .claude/skills/) to
  // inject into the sandbox and surface to the agent via the system prompt
  toolkits: z.array(z.string()).optional(),

  // MCP servers to connect to and expose as additional tools, keyed by name
  mcp_servers: z.record(McpServerConfigSchema).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
