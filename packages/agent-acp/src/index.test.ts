import { describe, expect, spyOn, test } from "bun:test";
import type { AgentConfig } from "@agentgrader/core";
import {
  buildPromptBlocks,
  buildTerminalShellCommand,
  convertMcpServersForAcp,
  extractTextContent,
  resolveAcpSpawn,
  resolveSandboxPath,
  shellQuote,
  sliceFileContent,
} from "./index";

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: "test-agent",
    model: "claude-haiku-4-5",
    max_steps: 30,
    step_timeout_ms: 120_000,
    ...overrides,
  } as AgentConfig;
}

describe("resolveAcpSpawn", () => {
  test("throws when acp_command is missing", () => {
    expect(() => resolveAcpSpawn(makeConfig())).toThrow(/acp_command is required/);
  });

  test("uses acp_args verbatim when provided", () => {
    expect(resolveAcpSpawn(makeConfig({ acp_command: "claude", acp_args: ["--acp"] }))).toEqual({
      command: "claude",
      args: ["--acp"],
    });
  });

  test("splits acp_command on whitespace when acp_args is absent", () => {
    expect(resolveAcpSpawn(makeConfig({ acp_command: "cursor-agent --acp --verbose" }))).toEqual({
      command: "cursor-agent",
      args: ["--acp", "--verbose"],
    });
  });

  test("splits a single-word acp_command into a command with no args", () => {
    expect(resolveAcpSpawn(makeConfig({ acp_command: "claude" }))).toEqual({
      command: "claude",
      args: [],
    });
  });

  test("throws when acp_command is only whitespace", () => {
    expect(() => resolveAcpSpawn(makeConfig({ acp_command: "   " }))).toThrow(
      /acp_command must not be empty/,
    );
  });
});

describe("resolveSandboxPath", () => {
  test("returns absolute paths unchanged", () => {
    expect(resolveSandboxPath("/etc/hosts", "/app")).toBe("/etc/hosts");
  });

  test("joins relative paths under the workspace root", () => {
    expect(resolveSandboxPath("src/index.ts", "/app")).toBe("/app/src/index.ts");
  });

  test("collapses duplicate slashes", () => {
    expect(resolveSandboxPath("./src/index.ts", "/app/")).toBe("/app/./src/index.ts");
  });
});

describe("shellQuote", () => {
  test("wraps a plain value in single quotes", () => {
    expect(shellQuote("hello")).toBe("'hello'");
  });

  test("escapes embedded single quotes", () => {
    expect(shellQuote("it's a test")).toBe("'it'\\''s a test'");
  });
});

describe("sliceFileContent", () => {
  const content = "line1\nline2\nline3\nline4\nline5";

  test("returns the full content when line and limit are both null", () => {
    expect(sliceFileContent(content, null, null)).toBe(content);
  });

  test("returns the full content when line and limit are both omitted", () => {
    expect(sliceFileContent(content)).toBe(content);
  });

  test("slices from a 1-indexed line to the end when limit is omitted", () => {
    expect(sliceFileContent(content, 3, null)).toBe("line3\nline4\nline5");
  });

  test("slices a limited number of lines starting from line", () => {
    expect(sliceFileContent(content, 2, 2)).toBe("line2\nline3");
  });

  test("defaults to line 1 when only limit is given", () => {
    expect(sliceFileContent(content, undefined, 2)).toBe("line1\nline2");
  });
});

describe("extractTextContent", () => {
  test("returns the text for a text content block", () => {
    expect(extractTextContent({ content: { type: "text", text: "hello" } })).toBe("hello");
  });

  test("returns undefined for a non-text content block", () => {
    expect(extractTextContent({ content: { type: "image" } })).toBeUndefined();
  });
});

describe("buildTerminalShellCommand", () => {
  const files = {
    outputFile: "/tmp/acp-term-1.out",
    exitFile: "/tmp/acp-term-1.exit",
    pidFile: "/tmp/acp-term-1.pid",
  };

  test("builds a backgrounded command with cd, redirect, exit code, and pid capture", () => {
    const cmd = buildTerminalShellCommand({
      cwd: "/app",
      command: "find-usages",
      ...files,
    });
    expect(cmd).toBe(
      "cd '/app' && ('find-usages') > '/tmp/acp-term-1.out' 2>&1; echo $? > '/tmp/acp-term-1.exit' & echo $! > '/tmp/acp-term-1.pid'",
    );
  });

  test("appends quoted args after the command", () => {
    const cmd = buildTerminalShellCommand({
      cwd: "/app",
      command: "find-usages",
      args: ["Foo", "src/bar.py"],
      ...files,
    });
    expect(cmd).toContain("('find-usages' 'Foo' 'src/bar.py') >");
  });

  test("prefixes env vars before the quoted command", () => {
    const cmd = buildTerminalShellCommand({
      cwd: "/app",
      command: "run-tests",
      env: [{ name: "PYTHONPATH", value: "/app/src" }],
      ...files,
    });
    expect(cmd).toContain("(PYTHONPATH='/app/src' 'run-tests') >");
  });

  test("escapes single quotes in the cwd, command, args, and env values", () => {
    const cmd = buildTerminalShellCommand({
      cwd: "/app/it's",
      command: "echo",
      args: ["it's a test"],
      env: [{ name: "MSG", value: "can't" }],
      ...files,
    });
    expect(cmd).toContain("cd '/app/it'\\''s'");
    expect(cmd).toContain("(MSG='can'\\''t' 'echo' 'it'\\''s a test') >");
  });
});

describe("buildPromptBlocks", () => {
  test("sends only the task prompt when system_prompt is unset", () => {
    expect(buildPromptBlocks({}, "Fix the bug in mathutils.py")).toEqual([
      { type: "text", text: "Fix the bug in mathutils.py" },
    ]);
  });

  test("sends system_prompt as a leading text block ahead of the task prompt", () => {
    const blocks = buildPromptBlocks(
      { system_prompt: "You are a professional developer.\n\nAvailable tools: find-usages, rename-symbol" },
      "Rename multiply to times.",
    );
    expect(blocks).toEqual([
      { type: "text", text: "You are a professional developer.\n\nAvailable tools: find-usages, rename-symbol" },
      { type: "text", text: "Rename multiply to times." },
    ]);
  });

  test("omits an empty-string system_prompt rather than sending a blank leading block", () => {
    expect(buildPromptBlocks({ system_prompt: "" }, "task")).toEqual([{ type: "text", text: "task" }]);
  });
});

describe("convertMcpServersForAcp", () => {
  test("returns an empty array when mcp_servers is undefined", () => {
    expect(convertMcpServersForAcp(undefined)).toEqual([]);
  });

  test("converts a stdio server, defaulting args/env to empty arrays", () => {
    const servers = convertMcpServersForAcp({
      "my-toolkit": { command: "my-toolkit-mcp" },
    });
    expect(servers).toEqual([{ name: "my-toolkit", command: "my-toolkit-mcp", args: [], env: [] }]);
  });

  test("converts a stdio server's args and env map to ACP's name/value list", () => {
    const servers = convertMcpServersForAcp({
      "my-toolkit": {
        command: "my-toolkit-mcp",
        args: ["--verbose"],
        env: { API_KEY: "secret" },
      },
    });
    expect(servers).toEqual([
      {
        name: "my-toolkit",
        command: "my-toolkit-mcp",
        args: ["--verbose"],
        env: [{ name: "API_KEY", value: "secret" }],
      },
    ]);
  });

  test("converts an http server, defaulting to type 'http' and an empty headers list", () => {
    const servers = convertMcpServersForAcp({
      remote: { url: "https://example.com/mcp" },
    });
    expect(servers).toEqual([{ type: "http", name: "remote", url: "https://example.com/mcp", headers: [] }]);
  });

  test("converts an sse server's headers map to ACP's name/value list", () => {
    const servers = convertMcpServersForAcp({
      remote: { type: "sse", url: "https://example.com/sse", headers: { Authorization: "Bearer xyz" } },
    });
    expect(servers).toEqual([
      {
        type: "sse",
        name: "remote",
        url: "https://example.com/sse",
        headers: [{ name: "Authorization", value: "Bearer xyz" }],
      },
    ]);
  });

  test("converts multiple servers, preserving config key order", () => {
    const servers = convertMcpServersForAcp({
      local: { command: "local-mcp" },
      remote: { url: "https://example.com/mcp" },
    });
    expect(servers.map((s) => s.name)).toEqual(["local", "remote"]);
  });

  test("skips a stdio server with sandboxed: true and warns, rather than forwarding sandbox-only paths", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const servers = convertMcpServersForAcp({
      "jetbrains-tools": { command: "bun", args: ["/app/mcp-server.ts"], sandboxed: true },
    });
    expect(servers).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("jetbrains-tools"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("sandboxed: true"));
    warnSpy.mockRestore();
  });

  test("keeps non-sandboxed stdio servers alongside a skipped sandboxed one", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const servers = convertMcpServersForAcp({
      local: { command: "local-mcp" },
      "jetbrains-tools": { command: "bun", args: ["/app/mcp-server.ts"], sandboxed: true },
    });
    expect(servers.map((s) => s.name)).toEqual(["local"]);
    warnSpy.mockRestore();
  });
});
