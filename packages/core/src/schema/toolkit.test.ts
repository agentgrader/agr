import { describe, expect, test } from "bun:test";
import { McpServerConfigSchema, SkillFrontmatterSchema } from "./toolkit";

describe("SkillFrontmatterSchema", () => {
  test("accepts a minimal valid frontmatter", () => {
    const result = SkillFrontmatterSchema.parse({
      name: "find-usages",
      description: "Find all usages of a symbol.",
    });
    expect(result.name).toBe("find-usages");
    expect(result.description).toBe("Find all usages of a symbol.");
  });

  test("accepts a hyphenated, multi-segment name", () => {
    expect(() =>
      SkillFrontmatterSchema.parse({ name: "show-call-hierarchy", description: "ok" }),
    ).not.toThrow();
  });

  test.each([
    ["Uppercase Letters", "Not Valid Name"],
    ["leading hyphen", "-find-usages"],
    ["trailing hyphen", "find-usages-"],
    ["double hyphen", "find--usages"],
    ["underscore", "find_usages"],
  ])("rejects a name with %s", (_label, name) => {
    expect(() => SkillFrontmatterSchema.parse({ name, description: "ok" })).toThrow();
  });

  test("rejects a name longer than 64 characters", () => {
    const name = "a".repeat(65);
    expect(() => SkillFrontmatterSchema.parse({ name, description: "ok" })).toThrow();
  });

  test("rejects a description longer than 1024 characters", () => {
    expect(() =>
      SkillFrontmatterSchema.parse({ name: "find-usages", description: "a".repeat(1025) }),
    ).toThrow();
  });

  test("accepts optional allowed-tools, disallowed-tools, and license", () => {
    const result = SkillFrontmatterSchema.parse({
      name: "find-usages",
      description: "ok",
      "allowed-tools": ["executeCommand"],
      "disallowed-tools": ["writeFile"],
      license: "MIT",
    });
    expect(result["allowed-tools"]).toEqual(["executeCommand"]);
    expect(result["disallowed-tools"]).toEqual(["writeFile"]);
    expect(result.license).toBe("MIT");
  });

  test("passes through unrecognized frontmatter fields", () => {
    const result = SkillFrontmatterSchema.parse({
      name: "find-usages",
      description: "ok",
      "metadata-version": "1.0",
    });
    expect((result as Record<string, unknown>)["metadata-version"]).toBe("1.0");
  });
});

describe("McpServerConfigSchema", () => {
  test("accepts a stdio server config (command + optional args/env)", () => {
    const result = McpServerConfigSchema.parse({
      command: "npx",
      args: ["-y", "@some/mcp-server"],
      env: { API_KEY: "secret" },
    });
    expect(result).toEqual({
      command: "npx",
      args: ["-y", "@some/mcp-server"],
      env: { API_KEY: "secret" },
    });
  });

  test("accepts a stdio server config with only command", () => {
    expect(() => McpServerConfigSchema.parse({ command: "my-mcp-server" })).not.toThrow();
  });

  test("accepts a stdio server config with sandboxed: true", () => {
    const result = McpServerConfigSchema.parse({
      command: "my-mcp-server",
      sandboxed: true,
    });
    expect(result).toEqual({ command: "my-mcp-server", sandboxed: true });
  });

  test("accepts an http/sse server config (url + optional type/headers)", () => {
    const result = McpServerConfigSchema.parse({
      type: "sse",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer abc" },
    });
    expect(result).toEqual({
      type: "sse",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer abc" },
    });
  });

  test("accepts an http/sse server config with only url", () => {
    expect(() => McpServerConfigSchema.parse({ url: "https://example.com/mcp" })).not.toThrow();
  });

  test("rejects a config with neither command nor url", () => {
    expect(() => McpServerConfigSchema.parse({ args: ["-y"] })).toThrow();
  });

  test("rejects an http/sse config with an invalid type", () => {
    expect(() => McpServerConfigSchema.parse({ type: "websocket", url: "https://example.com" })).toThrow();
  });
});
