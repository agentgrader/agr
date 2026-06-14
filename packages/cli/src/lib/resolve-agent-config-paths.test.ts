import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  expandAgentConfigGlob,
  findAgentConfigYamlFilesInDir,
  resolveAgentConfigPathList,
} from "./resolve-agent-config-paths";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agr-config-paths-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function touch(relPath: string) {
  const full = join(dir, relPath);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, "");
}

describe("findAgentConfigYamlFilesInDir", () => {
  test("returns only top-level .yaml/.yml files, sorted, ignoring dotfiles and subdirs", () => {
    touch("b.yaml");
    touch("a.yml");
    touch("notes.txt");
    touch(".hidden.yaml");
    touch("nested/c.yaml");

    expect(findAgentConfigYamlFilesInDir(dir)).toEqual([resolve(dir, "a.yml"), resolve(dir, "b.yaml")]);
  });
});

describe("expandAgentConfigGlob", () => {
  test("expands a simple *.yaml glob relative to baseDir", () => {
    touch("a.yaml");
    touch("b.yaml");
    touch("c.yml");

    expect(expandAgentConfigGlob("*.yaml", dir)).toEqual([resolve(dir, "a.yaml"), resolve(dir, "b.yaml")]);
  });

  test("expands a glob within a subdirectory", () => {
    touch("configs/a.yaml");
    touch("configs/b.txt");

    expect(expandAgentConfigGlob("configs/*.yaml", dir)).toEqual([resolve(dir, "configs/a.yaml")]);
  });

  test("expands a ** glob recursively, defaulting to *.yaml", () => {
    touch("configs/a.yaml");
    touch("configs/nested/b.yaml");
    touch("configs/nested/c.yml");

    expect(expandAgentConfigGlob("configs/**", dir)).toEqual([
      resolve(dir, "configs/a.yaml"),
      resolve(dir, "configs/nested/b.yaml"),
    ]);
  });

  test("expands a ** glob with an explicit suffix pattern", () => {
    touch("configs/a.yaml");
    touch("configs/nested/b.yml");

    expect(expandAgentConfigGlob("configs/**/*.yml", dir)).toEqual([resolve(dir, "configs/nested/b.yml")]);
  });
});

describe("resolveAgentConfigPathList", () => {
  test("collects paths from commaSeparated, dir, explicitPaths, and globs, deduplicated and sorted", () => {
    touch("a.yaml");
    touch("b.yaml");
    touch("c.yaml");

    const result = resolveAgentConfigPathList({
      commaSeparated: `${join(dir, "a.yaml")}, ${join(dir, "b.yaml")}`,
      dir,
      explicitPaths: ["c.yaml"],
      globs: ["*.yaml"],
      relativeTo: dir,
    });

    expect(result).toEqual([resolve(dir, "a.yaml"), resolve(dir, "b.yaml"), resolve(dir, "c.yaml")]);
  });

  test("throws when no config files are found", () => {
    expect(() => resolveAgentConfigPathList({})).toThrow(/No agent config YAML files found/);
  });
});
