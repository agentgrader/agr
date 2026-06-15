import { describe, expect, test } from "bun:test";
import { AgentConfigSchema } from "./agent-config";

describe("AgentConfigSchema", () => {
  test("accepts a minimal config and applies defaults", () => {
    const result = AgentConfigSchema.parse({
      name: "claude-haiku-jetbrains-tools",
      model: "claude-haiku-4-5-20251001",
    });
    expect(result.max_steps).toBe(30);
    expect(result.step_timeout_ms).toBe(120_000);
    expect(result.id).toBeUndefined();
    expect(result.provider).toBeUndefined();
  });

  test("rejects a config missing required fields", () => {
    expect(() => AgentConfigSchema.parse({ name: "no-model" })).toThrow();
    expect(() => AgentConfigSchema.parse({ model: "no-name" })).toThrow();
  });

  test("accepts explicit max_steps and step_timeout_ms overrides", () => {
    const result = AgentConfigSchema.parse({
      name: "n",
      model: "m",
      max_steps: 50,
      step_timeout_ms: 90_000,
    });
    expect(result.max_steps).toBe(50);
    expect(result.step_timeout_ms).toBe(90_000);
  });

  test("accepts optional toolkit/adoption-tracking fields", () => {
    const result = AgentConfigSchema.parse({
      name: "n",
      model: "m",
      toolkits: ["./toolkits/jetbrains-tools"],
      require_tools_before_submit: ["run-tests", "inspect-code"],
      track_tools: ["find-usages", "show-diff"],
    });
    expect(result.toolkits).toEqual(["./toolkits/jetbrains-tools"]);
    expect(result.require_tools_before_submit).toEqual(["run-tests", "inspect-code"]);
    expect(result.track_tools).toEqual(["find-usages", "show-diff"]);
  });

  test("accepts an mcp_servers map keyed by server name", () => {
    const result = AgentConfigSchema.parse({
      name: "n",
      model: "m",
      mcp_servers: {
        filesystem: { command: "npx", args: ["-y", "@some/mcp-server"] },
        remote: { url: "https://example.com/mcp" },
      },
    });
    expect(result.mcp_servers?.filesystem?.command).toBe("npx");
    expect(result.mcp_servers?.remote?.url).toBe("https://example.com/mcp");
  });

  test("accepts model-escalation fields", () => {
    const result = AgentConfigSchema.parse({
      name: "n",
      model: "claude-haiku-4-5-20251001",
      escalate_after_steps: 10,
      escalate_model: "claude-sonnet-4-6",
    });
    expect(result.escalate_after_steps).toBe(10);
    expect(result.escalate_model).toBe("claude-sonnet-4-6");
  });

  test("accepts ACP-related fields for ACP-backed agents", () => {
    const result = AgentConfigSchema.parse({
      name: "n",
      model: "m",
      acp_command: "claude",
      acp_args: ["--acp"],
      acp_cwd: "/app",
      acp_env: { FOO: "bar" },
    });
    expect(result.acp_command).toBe("claude");
    expect(result.acp_args).toEqual(["--acp"]);
    expect(result.acp_cwd).toBe("/app");
    expect(result.acp_env).toEqual({ FOO: "bar" });
  });
});
