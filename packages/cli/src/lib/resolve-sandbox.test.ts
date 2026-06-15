import { describe, expect, test } from "bun:test";
import { resolveSandbox } from "./resolve-sandbox";

describe("resolveSandbox", () => {
  test("resolves docker by default", () => {
    expect(resolveSandbox("docker").name).toBe("docker");
  });

  test("resolves e2b", () => {
    expect(resolveSandbox("e2b").name).toBe("e2b");
  });

  test("throws on unknown provider", () => {
    expect(() => resolveSandbox("unknown")).toThrow("Unknown sandbox provider");
  });
});
