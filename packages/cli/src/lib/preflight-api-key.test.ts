import { afterEach, describe, expect, test } from "bun:test";
import type { AgentConfig } from "@agentgrader/core";
import { missingApiKeyForAgentConfig } from "./preflight-api-key";

const ENV_KEYS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"] as const;

function clearKeys() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("missingApiKeyForAgentConfig", () => {
  afterEach(() => clearKeys());

  test("requires ANTHROPIC_API_KEY for anthropic provider", () => {
    const config: AgentConfig = {
      name: "test",
      model: "claude-haiku-4-5-20251001",
      provider: "anthropic",
      max_steps: 5,
    };
    expect(missingApiKeyForAgentConfig(config)).toBe("ANTHROPIC_API_KEY");
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(missingApiKeyForAgentConfig(config)).toBeUndefined();
  });
});
