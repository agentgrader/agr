import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { toolkitAddCommand, toolkitListCommand } from "./toolkit";

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

describe("toolkitListCommand", () => {
  let toolkitDir: string;
  let logs: string[];
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    toolkitDir = mkdtempSync(join(tmpdir(), "agr-toolkit-list-"));
    mkdirSync(join(toolkitDir, "bin"), { recursive: true });
    mkdirSync(join(toolkitDir, ".claude", "skills", "find-usages"), { recursive: true });

    writeFileSync(join(toolkitDir, "bin", "find-usages"), "#!/bin/sh\necho find-usages\n", { mode: 0o755 });
    writeFileSync(join(toolkitDir, "bin", "add-import"), "#!/bin/sh\necho add-import\n", { mode: 0o755 });
    writeFileSync(
      join(toolkitDir, ".claude", "skills", "find-usages", "SKILL.md"),
      "---\nname: find-usages\ndescription: Find all references to an identifier.\n---\n\n# find-usages\n",
    );

    logs = [];
    logSpy = spyOn(console, "log").mockImplementation((msg: string) => {
      logs.push(msg);
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(toolkitDir, { recursive: true, force: true });
  });

  test("throws if <dir>/bin doesn't exist", async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "agr-toolkit-list-empty-"));
    await expect(toolkitListCommand(emptyDir, {})).rejects.toThrow(/does not exist/);
    rmSync(emptyDir, { recursive: true, force: true });
  });

  test("lists bin/ tools with SKILL.md descriptions, flagging tools without one", async () => {
    await toolkitListCommand(toolkitDir, {});

    const output = logs.join("\n");
    expect(output).toContain("find-usages");
    expect(output).toContain("Find all references to an identifier.");
    expect(output).toContain("add-import");
    expect(output).toContain("(no .claude/skills/add-import/SKILL.md)");
    expect(output).toContain("2 tool(s), 1 with SKILL.md.");
  });

  test("--check-config reports untracked and missing tools", async () => {
    const configPath = join(toolkitDir, "agent.yaml");
    writeFileSync(configPath, "track_tools:\n  - find-usages\n  - nonexistent-tool\n");

    await toolkitListCommand(toolkitDir, { checkConfig: configPath });

    const output = logs.join("\n");
    expect(output).toContain("In " + toolkitDir + "/bin/ but not tracked: add-import");
    expect(output).toContain("Tracked but not in " + toolkitDir + "/bin/: nonexistent-tool");
  });

  test("--check-config reports all tracked when track_tools covers every bin/ tool", async () => {
    const configPath = join(toolkitDir, "agent.yaml");
    writeFileSync(configPath, "track_tools:\n  - find-usages\n  - add-import\n");

    await toolkitListCommand(toolkitDir, { checkConfig: configPath });

    const output = logs.join("\n");
    expect(output).toContain("All toolkit tools are tracked.");
  });

  test("--check-config reads track_tools nested under base: (matrix config files)", async () => {
    const configPath = join(toolkitDir, "matrix.yaml");
    writeFileSync(configPath, "base:\n  track_tools:\n    - find-usages\n    - add-import\n");

    await toolkitListCommand(toolkitDir, { checkConfig: configPath });

    const output = logs.join("\n");
    expect(output).toContain("All toolkit tools are tracked.");
  });

  test("ignores non-executable files in bin/ (e.g. tools.test.ts)", async () => {
    writeFileSync(join(toolkitDir, "bin", "tools.test.ts"), "// not a tool\n");

    await toolkitListCommand(toolkitDir, {});

    const output = logs.join("\n");
    expect(output).not.toContain("tools.test.ts");
    expect(output).toContain("2 tool(s), 1 with SKILL.md.");
  });
});
