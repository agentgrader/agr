import { AcpAgentAdapter } from "@agentgrader/agent-acp";
import { AiSdkAgentAdapter } from "@agentgrader/agent-openrouter";
import type { AgentAdapter } from "@agentgrader/core";

const ADAPTERS: Record<string, () => AgentAdapter> = {
  "ai-sdk": () => new AiSdkAgentAdapter(),
  openrouter: () => new AiSdkAgentAdapter(),
  acp: () => new AcpAgentAdapter(),
};

export function resolveAdapter(name: string): AgentAdapter {
  const factory = ADAPTERS[name];
  if (!factory) {
    throw new Error(
      `Unknown adapter "${name}". Supported adapters: ${Object.keys(ADAPTERS).join(", ")}.`,
    );
  }
  return factory();
}

export function resolveAdapters(names: string[]): AgentAdapter[] {
  const unique = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  if (unique.length === 0) {
    return [new AiSdkAgentAdapter()];
  }
  return unique.map(resolveAdapter);
}
