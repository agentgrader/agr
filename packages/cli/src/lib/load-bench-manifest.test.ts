import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  loadBenchManifest,
  resolveManifestAgentConfigPaths,
  resolveManifestSuiteDir,
} from "./load-bench-manifest";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agr-load-bench-manifest-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeYaml(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("loadBenchManifest", () => {
  test("parses a manifest with explicit agent paths", () => {
    const path = writeYaml(
      "bench.yaml",
      `
name: my-bench
suite: ./suite
agents:
  paths:
    - ./agents/a.yaml
    - ./agents/b.yaml
`,
    );

    const manifest = loadBenchManifest(path);
    expect(manifest.name).toBe("my-bench");
    expect(manifest.suite).toBe("./suite");
    expect(manifest.agents.paths).toEqual(["./agents/a.yaml", "./agents/b.yaml"]);
  });

  test("parses a manifest with a glob", () => {
    const path = writeYaml(
      "bench.yaml",
      `
suite: ./suite
agents:
  glob: "./agents/*.yaml"
`,
    );

    const manifest = loadBenchManifest(path);
    expect(manifest.agents.glob).toBe("./agents/*.yaml");
  });

  test("throws when agents specifies neither paths nor glob", () => {
    const path = writeYaml(
      "bench.yaml",
      `
suite: ./suite
agents: {}
`,
    );

    expect(() => loadBenchManifest(path)).toThrow();
  });

  test("throws when suite is missing", () => {
    const path = writeYaml(
      "bench.yaml",
      `
agents:
  glob: "./agents/*.yaml"
`,
    );

    expect(() => loadBenchManifest(path)).toThrow();
  });
});

describe("resolveManifestSuiteDir", () => {
  test("resolves the suite path relative to the manifest file's directory", () => {
    const path = writeYaml(
      "bench.yaml",
      `
suite: ./suite
agents:
  glob: "./agents/*.yaml"
`,
    );

    const manifest = loadBenchManifest(path);
    expect(resolveManifestSuiteDir(manifest, path)).toBe(resolve(dir, "suite"));
  });
});

describe("resolveManifestAgentConfigPaths", () => {
  test("resolves explicit agent config paths relative to the manifest file's directory", () => {
    mkdirSync(join(dir, "agents"), { recursive: true });
    writeFileSync(join(dir, "agents/a.yaml"), "name: a\nmodel: claude-haiku-4-5\n");
    writeFileSync(join(dir, "agents/b.yaml"), "name: b\nmodel: claude-haiku-4-5\n");

    const path = writeYaml(
      "bench.yaml",
      `
suite: ./suite
agents:
  paths:
    - ./agents/a.yaml
    - ./agents/b.yaml
`,
    );

    const manifest = loadBenchManifest(path);
    expect(resolveManifestAgentConfigPaths(manifest, path)).toEqual([
      resolve(dir, "agents/a.yaml"),
      resolve(dir, "agents/b.yaml"),
    ]);
  });

  test("resolves agent config paths from a glob", () => {
    mkdirSync(join(dir, "agents"), { recursive: true });
    writeFileSync(join(dir, "agents/a.yaml"), "name: a\nmodel: claude-haiku-4-5\n");
    writeFileSync(join(dir, "agents/b.yaml"), "name: b\nmodel: claude-haiku-4-5\n");

    const path = writeYaml(
      "bench.yaml",
      `
suite: ./suite
agents:
  glob: "./agents/*.yaml"
`,
    );

    const manifest = loadBenchManifest(path);
    expect(resolveManifestAgentConfigPaths(manifest, path)).toEqual([
      resolve(dir, "agents/a.yaml"),
      resolve(dir, "agents/b.yaml"),
    ]);
  });
});
