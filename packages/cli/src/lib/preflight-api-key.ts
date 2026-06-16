import type { AgentConfig } from "@agentgrader/core";
import { resolveProvider } from "@agentgrader/agent-openrouter";

const KEY_BY_PROVIDER: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export function missingApiKeyForAgentConfig(agentConfig: AgentConfig): string | undefined {
  const provider = resolveProvider({
    provider: agentConfig.provider,
    model: agentConfig.model,
  });
  const envVar = KEY_BY_PROVIDER[provider] ?? KEY_BY_PROVIDER.openrouter;
  if (process.env[envVar]) return undefined;
  return envVar;
}

export function formatMissingApiKeyMessage(envVar: string, envPath?: string): string {
  const where = envPath ? `.env (${envPath})` : ".env in your project root";
  return `${envVar} is not set. Add it to ${where} or export it in your shell.`;
}
