import { describe, expect, test } from "bun:test";
import type { AgentConfig } from "@agentgrader/core";
import {
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
