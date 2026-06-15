import { describe, expect, test } from "bun:test";
import { parseProxyArgs } from "./proxy";

describe("parseProxyArgs", () => {
  test("parses bridge id and inner command", () => {
    const result = parseProxyArgs([
      "--bridge-id",
      "abc123",
      "--",
      "bun",
      "/app/mcp-server.ts",
    ]);
    expect(result.bridgeId).toBe("abc123");
    expect(result.innerCommand).toContain("bun");
    expect(result.innerCommand).toContain("/app/mcp-server.ts");
  });
});
