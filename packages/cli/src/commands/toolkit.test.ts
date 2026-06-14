import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { toolkitAddCommand } from "./toolkit";

describe("toolkitAddCommand", () => {
  let toolkitDir: string;
  let cwd: string;

  beforeEach(() => {
    cwd = process.cwd();
    toolkitDir = mkdtempSync(join(tmpdir(), "agr-toolkit-add-"));
  });

  afterEach(() => {
    process.chdir(cwd);
    rmSync(toolkitDir, { recursive: true, force: true });
  });

  test("rejects invalid tool names", async () => {
    await expect(toolkitAddCommand("Find Usages", { dir: toolkitDir })).rejects.toThrow(
      /use lowercase letters, digits, and hyphens/,
    );
    await expect(toolkitAddCommand("1-find-usages", { dir: toolkitDir })).rejects.toThrow(
      /use lowercase letters, digits, and hyphens/,
    );
  });

  test("scaffolds bin/<name> and .claude/skills/<name>/SKILL.md", async () => {
    await toolkitAddCommand("find-usages", { dir: toolkitDir });

    const binPath = join(toolkitDir, "bin", "find-usages");
    const skillPath = join(toolkitDir, ".claude", "skills", "find-usages", "SKILL.md");

    expect(existsSync(binPath)).toBe(true);
    expect(existsSync(skillPath)).toBe(true);

    const binContent = readFileSync(binPath, "utf-8");
    expect(binContent).toContain("#!/bin/sh");
    expect(binContent).toContain("find-usages: not yet implemented");

    const skillContent = readFileSync(skillPath, "utf-8");
    expect(skillContent).toContain("name: find-usages");
    expect(skillContent).toContain("# find-usages");
  });

  test("makes the bin script executable", async () => {
    await toolkitAddCommand("find-usages", { dir: toolkitDir });

    const binPath = join(toolkitDir, "bin", "find-usages");
    const mode = (await import("node:fs")).statSync(binPath).mode;
    expect(mode & 0o111).toBe(0o111);
  });

  test("throws if the bin script already exists", async () => {
    await toolkitAddCommand("find-usages", { dir: toolkitDir });
    await expect(toolkitAddCommand("find-usages", { dir: toolkitDir })).rejects.toThrow(/already exists/);
  });

  test("defaults to ./toolkit relative to the current working directory", async () => {
    process.chdir(toolkitDir);
    await toolkitAddCommand("inspect-code", {});

    expect(existsSync(join(toolkitDir, "toolkit", "bin", "inspect-code"))).toBe(true);
    expect(existsSync(join(toolkitDir, "toolkit", ".claude", "skills", "inspect-code", "SKILL.md"))).toBe(true);
  });
});
