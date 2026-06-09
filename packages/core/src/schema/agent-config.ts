import { z } from "zod";

export const AgentConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  model: z.string(),
  max_steps: z.number().default(30),
  temperature: z.number().optional(),
  system_prompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
