import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadMatrix } from "./load-matrix";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agr-load-matrix-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeYaml(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("loadMatrix", () => {
  test("parses a valid matrix file", () => {
    const path = writeYaml(
      "matrix.yaml",
      `
name: my-matrix
base:
  model: anthropic/claude-sonnet-4-6
dimensions:
  toolkits:
    - []
    - ["./toolkits/jetbrains-tools"]
`,
    );

    const matrix = loadMatrix(path);
    expect(matrix.name).toBe("my-matrix");
    expect(matrix.base.model).toBe("anthropic/claude-sonnet-4-6");
    expect(matrix.dimensions.toolkits).toEqual([[], ["./toolkits/jetbrains-tools"]]);
  });

  test("defaults base to {} when omitted", () => {
    const path = writeYaml(
      "matrix.yaml",
      `
name: my-matrix
dimensions:
  model:
    - anthropic/claude-haiku-4-5
    - anthropic/claude-sonnet-4-6
`,
    );

    const matrix = loadMatrix(path);
    expect(matrix.base).toEqual({});
  });

  test("throws when no dimension has a non-empty array", () => {
    const path = writeYaml(
      "matrix.yaml",
      `
name: my-matrix
dimensions: {}
`,
    );

    expect(() => loadMatrix(path)).toThrow(/at least one non-empty dimension/);
  });

  test("throws when name is missing", () => {
    const path = writeYaml(
      "matrix.yaml",
      `
dimensions:
  model:
    - anthropic/claude-haiku-4-5
`,
    );

    expect(() => loadMatrix(path)).toThrow();
  });
});
