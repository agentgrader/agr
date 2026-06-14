import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadAgentConfig } from "./load-agent-config";

let dir: string;
let originalWarn: typeof console.warn;
let warnCalls: unknown[][];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agr-load-agent-config-"));
  originalWarn = console.warn;
  warnCalls = [];
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args);
  };
});

afterEach(() => {
  console.warn = originalWarn;
  rmSync(dir, { recursive: true, force: true });
});

function writeYaml(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("loadAgentConfig", () => {
  test("parses a minimal config and applies defaults", () => {
    const path = writeYaml(
      "agent.yaml",
      `
name: my-agent
model: claude-haiku-4-5
`,
    );

    const config = loadAgentConfig(path);
    expect(config.name).toBe("my-agent");
    expect(config.model).toBe("claude-haiku-4-5");
    expect(config.max_steps).toBe(30);
    expect(config.step_timeout_ms).toBe(120_000);
  });

  test("falls back to name for id when id is not set", () => {
    const path = writeYaml(
      "agent.yaml",
      `
name: my-agent
model: claude-haiku-4-5
`,
    );

    expect(loadAgentConfig(path).id).toBe("my-agent");
  });

  test("preserves an explicit id", () => {
    const path = writeYaml(
      "agent.yaml",
      `
id: custom-id
name: my-agent
model: claude-haiku-4-5
`,
    );

    expect(loadAgentConfig(path).id).toBe("custom-id");
  });

  test("resolves toolkits paths relative to the yaml file's directory", () => {
    mkdirSync(join(dir, "toolkits/jetbrains-tools"), { recursive: true });
    const path = writeYaml(
      "agent.yaml",
      `
name: my-agent
model: claude-haiku-4-5
toolkits:
  - ./toolkits/jetbrains-tools
`,
    );

    const config = loadAgentConfig(path);
    expect(config.toolkits).toEqual([resolve(dir, "toolkits/jetbrains-tools")]);
  });

  test("leaves absolute toolkit paths unchanged", () => {
    const absToolkit = resolve(dir, "abs-toolkit");
    mkdirSync(absToolkit, { recursive: true });
    const path = writeYaml(
      "agent.yaml",
      `
name: my-agent
model: claude-haiku-4-5
toolkits:
  - ${absToolkit}
`,
    );

    expect(loadAgentConfig(path).toolkits).toEqual([absToolkit]);
  });

  test("throws a formatted error for an invalid config", () => {
    const path = writeYaml(
      "agent.yaml",
      `
name: my-agent
max_steps: "not a number"
`,
    );

    expect(() => loadAgentConfig(path)).toThrow(/Invalid agent config/);
  });

  test("warns about unrecognized top-level keys but still parses", () => {
    const path = writeYaml(
      "agent.yaml",
      `
name: my-agent
model: claude-haiku-4-5
some_future_field: 42
`,
    );

    const config = loadAgentConfig(path);
    expect(config.name).toBe("my-agent");
    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0]?.[0]).toContain('"some_future_field"');
  });
});
