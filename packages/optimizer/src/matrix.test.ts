import { describe, expect, test } from "bun:test";
import { expandMatrix, MatrixSchema } from "./matrix";

describe("expandMatrix", () => {
  test("expands a single dimension into one config per value", () => {
    const matrix = MatrixSchema.parse({
      name: "toolkits",
      base: { model: "claude-haiku-4-5-20251001", provider: "anthropic" },
      dimensions: { toolkits: [[], ["./toolkits/jetbrains-tools"]] },
    });

    const configs = expandMatrix(matrix);

    expect(configs).toHaveLength(2);
    expect(configs[0]!.id).toBe("toolkits-none");
    expect(configs[0]!.toolkits).toEqual([]);
    expect(configs[1]!.id).toBe("toolkits-toolkits-jetbrains-tools");
    expect(configs[1]!.toolkits).toEqual(["./toolkits/jetbrains-tools"]);

    for (const config of configs) {
      expect(config.model).toBe("claude-haiku-4-5-20251001");
      expect(config.provider).toBe("anthropic");
    }
  });

  test("expands the cartesian product across multiple dimensions", () => {
    const matrix = MatrixSchema.parse({
      name: "sweep",
      dimensions: {
        model: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"],
        temperature: [0, 1],
      },
    });

    const configs = expandMatrix(matrix);

    expect(configs).toHaveLength(4);
    expect(configs.map((c) => c.id)).toEqual([
      "sweep-claude-haiku-4-5-20251001-0",
      "sweep-claude-haiku-4-5-20251001-1",
      "sweep-claude-sonnet-4-6-0",
      "sweep-claude-sonnet-4-6-1",
    ]);
  });

  test("applies max_steps/step_timeout_ms defaults when not specified", () => {
    const matrix = MatrixSchema.parse({
      name: "defaults",
      dimensions: { model: ["claude-haiku-4-5-20251001"] },
    });

    const [config] = expandMatrix(matrix);

    expect(config!.max_steps).toBe(30);
    expect(config!.step_timeout_ms).toBe(120_000);
  });

  test("carries require_tools_before_submit and track_tools from base onto every combo", () => {
    const matrix = MatrixSchema.parse({
      name: "tools",
      base: {
        require_tools_before_submit: ["run-tests", "inspect-code"],
        track_tools: ["find-usages", "safe-delete"],
      },
      dimensions: { toolkits: [[], ["./toolkits/jetbrains-tools"]] },
    });

    const configs = expandMatrix(matrix);

    for (const config of configs) {
      expect(config.require_tools_before_submit).toEqual(["run-tests", "inspect-code"]);
      expect(config.track_tools).toEqual(["find-usages", "safe-delete"]);
    }
  });

  test("rejects a matrix with no non-empty dimensions", () => {
    expect(() => MatrixSchema.parse({ name: "empty", dimensions: {} })).toThrow();
  });
});
