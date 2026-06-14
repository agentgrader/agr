import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { formatZodError } from "./format-zod-error";

describe("formatZodError", () => {
  test("formats a single issue with its field path", () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 42 });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");

    const message = formatZodError(result.error, "config.yaml");
    expect(message).toContain("Invalid config.yaml:");
    expect(message).toContain("- name:");
  });

  test("formats multiple issues, one per line", () => {
    const schema = z.object({ name: z.string(), max_steps: z.number() });
    const result = schema.safeParse({ name: 1, max_steps: "oops" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");

    const lines = formatZodError(result.error, "agent.yaml").split("\n");
    expect(lines[0]).toBe("Invalid agent.yaml:");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("- name:");
    expect(lines[2]).toContain("- max_steps:");
  });

  test("uses (root) for issues with an empty path", () => {
    const schema = z.string();
    const result = schema.safeParse(123);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");

    const message = formatZodError(result.error, "value.yaml");
    expect(message).toContain("- (root):");
  });
});
