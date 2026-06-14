import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolveProvider } from "./index";

const ENV_KEYS = ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("resolveProvider", () => {
  test("returns an explicit provider unchanged, regardless of model or keys", () => {
    expect(resolveProvider({ provider: "openrouter", model: "claude-haiku-4-5" })).toBe("openrouter");
  });

  test("falls back to openrouter when no keys and no model are set", () => {
    expect(resolveProvider({})).toBe("openrouter");
  });

  test("resolves a claude- model to anthropic when ANTHROPIC_API_KEY is set and no openrouter key", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(resolveProvider({ model: "claude-haiku-4-5" })).toBe("anthropic");
  });

  test("resolves a gpt- model to openai when OPENAI_API_KEY is the only key", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(resolveProvider({ model: "gpt-4o-mini" })).toBe("openai");
  });

  test("does not resolve to anthropic for a claude- model without ANTHROPIC_API_KEY", () => {
    expect(resolveProvider({ model: "claude-haiku-4-5" })).toBe("openrouter");
  });

  test("prefers openrouter when OPENROUTER_API_KEY is set, even for a claude- model", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(resolveProvider({ model: "claude-haiku-4-5" })).toBe("openrouter");
  });

  test("prefers a matching native provider over OPENAI_API_KEY's openrouter fallback", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(resolveProvider({ model: "claude-haiku-4-5" })).toBe("anthropic");
  });

  test("resolves o-series model names (e.g. o1, o3) to openai", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(resolveProvider({ model: "o3-mini" })).toBe("openai");
  });
});
