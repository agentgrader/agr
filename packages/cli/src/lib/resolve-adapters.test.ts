import { AcpAgentAdapter } from "@agentgrader/agent-acp";
import { AiSdkAgentAdapter } from "@agentgrader/agent-openrouter";
import { describe, expect, test } from "bun:test";
import { resolveAdapter, resolveAdapters } from "./resolve-adapters";

describe("resolveAdapter", () => {
  test("resolves known adapter names", () => {
    expect(resolveAdapter("ai-sdk")).toBeInstanceOf(AiSdkAgentAdapter);
    expect(resolveAdapter("openrouter")).toBeInstanceOf(AiSdkAgentAdapter);
    expect(resolveAdapter("acp")).toBeInstanceOf(AcpAgentAdapter);
  });

  test("throws a helpful error for an unknown adapter name", () => {
    expect(() => resolveAdapter("unknown")).toThrow(/Unknown adapter "unknown"/);
    expect(() => resolveAdapter("unknown")).toThrow(/ai-sdk, openrouter, acp/);
  });
});

describe("resolveAdapters", () => {
  test("defaults to a single ai-sdk adapter when given no names", () => {
    const adapters = resolveAdapters([]);
    expect(adapters).toHaveLength(1);
    expect(adapters[0]).toBeInstanceOf(AiSdkAgentAdapter);
  });

  test("defaults to a single ai-sdk adapter when given only blank names", () => {
    const adapters = resolveAdapters(["", "  "]);
    expect(adapters).toHaveLength(1);
    expect(adapters[0]).toBeInstanceOf(AiSdkAgentAdapter);
  });

  test("resolves and deduplicates multiple adapter names, trimming whitespace", () => {
    const adapters = resolveAdapters([" ai-sdk", "acp", "ai-sdk "]);
    expect(adapters).toHaveLength(2);
    expect(adapters[0]).toBeInstanceOf(AiSdkAgentAdapter);
    expect(adapters[1]).toBeInstanceOf(AcpAgentAdapter);
  });
});
