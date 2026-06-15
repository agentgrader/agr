import type { SandboxStdioProcess } from "@agentgrader/core";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildSandboxedMcpCommand, resolveProvider, SandboxStdioMcpTransport } from "./index";

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

describe("buildSandboxedMcpCommand", () => {
  test("builds a plain command with args, quoted for sh -c", () => {
    expect(buildSandboxedMcpCommand({ command: "my-mcp-server", args: ["--verbose", "a b"] })).toBe(
      "'my-mcp-server' '--verbose' 'a b'",
    );
  });

  test("prefixes env vars before the command", () => {
    expect(
      buildSandboxedMcpCommand({ command: "my-mcp-server", env: { API_KEY: "sk-it's-a-secret" } }),
    ).toBe(`API_KEY='sk-it'\\''s-a-secret' 'my-mcp-server'`);
  });
});

describe("SandboxStdioMcpTransport", () => {
  function fakeSandbox(process: SandboxStdioProcess) {
    return { spawnStdio: async () => process };
  }

  function fakeProcess(): SandboxStdioProcess & {
    stdoutHandler?: (chunk: string) => void;
    written: string[];
    closed: boolean;
  } {
    const proc = {
      written: [] as string[],
      closed: false,
      stdoutHandler: undefined as ((chunk: string) => void) | undefined,
      write(data: string) {
        proc.written.push(data);
      },
      onStdout(handler: (chunk: string) => void) {
        proc.stdoutHandler = handler;
      },
      onStderr() {},
      onExit() {},
      close() {
        proc.closed = true;
      },
    };
    return proc;
  }

  test("send() writes a newline-delimited JSON-RPC message", async () => {
    const proc = fakeProcess();
    const transport = new SandboxStdioMcpTransport(fakeSandbox(proc) as any, "my-mcp-server");
    await transport.start();

    await transport.send({ jsonrpc: "2.0", id: 1, method: "ping" } as any);

    expect(proc.written).toEqual([`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })}\n`]);
  });

  test("onmessage fires once per newline-delimited JSON message, across chunk boundaries", async () => {
    const proc = fakeProcess();
    const transport = new SandboxStdioMcpTransport(fakeSandbox(proc) as any, "my-mcp-server");

    const received: unknown[] = [];
    transport.onmessage = (message) => received.push(message);
    await transport.start();

    const messageA = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "a" });
    const messageB = JSON.stringify({ jsonrpc: "2.0", id: 2, result: "b" });
    proc.stdoutHandler?.(`${messageA}\n${messageB.slice(0, 5)}`);
    proc.stdoutHandler?.(`${messageB.slice(5)}\n`);

    expect(received).toEqual([JSON.parse(messageA), JSON.parse(messageB)]);
  });

  test("close() closes the underlying sandbox process", async () => {
    const proc = fakeProcess();
    const transport = new SandboxStdioMcpTransport(fakeSandbox(proc) as any, "my-mcp-server");
    await transport.start();

    await transport.close();

    expect(proc.closed).toBe(true);
  });

  test("start() throws when the sandbox does not implement spawnStdio", async () => {
    const transport = new SandboxStdioMcpTransport({} as any, "my-mcp-server");
    await expect(transport.start()).rejects.toThrow("spawnStdio");
  });
});
