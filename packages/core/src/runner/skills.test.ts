import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { buildSkillsPromptAddendum, discoverSkills, discoverSkillsForToolkits, parseSkillMarkdown } from "./skills";

describe("parseSkillMarkdown", () => {
  test("parses a valid frontmatter block and trims the body", () => {
    const content = `---\nname: find-usages\ndescription: Find all usages of a symbol.\n---\n\nUsage instructions here.\n`;
    const skill = parseSkillMarkdown(content, "/app/.claude/skills/find-usages/SKILL.md", "/app/.claude/skills/find-usages");
    expect(skill.frontmatter.name).toBe("find-usages");
    expect(skill.frontmatter.description).toBe("Find all usages of a symbol.");
    expect(skill.body).toBe("Usage instructions here.");
    expect(skill.path).toBe("/app/.claude/skills/find-usages/SKILL.md");
    expect(skill.dir).toBe("/app/.claude/skills/find-usages");
  });

  test("throws when there is no '---'-delimited frontmatter block", () => {
    expect(() => parseSkillMarkdown("# Just a heading\n", "SKILL.md", ".")).toThrow(/missing a YAML frontmatter block/);
  });

  test("throws when frontmatter fails schema validation", () => {
    const content = `---\nname: Not Valid Name\ndescription: ok\n---\nbody\n`;
    expect(() => parseSkillMarkdown(content, "SKILL.md", ".")).toThrow(/Invalid SKILL.md frontmatter/);
  });
});

describe("discoverSkills / discoverSkillsForToolkits", () => {
  let toolkitDir: string;

  afterEach(() => {
    if (toolkitDir) rmSync(toolkitDir, { recursive: true, force: true });
  });

  function writeSkill(toolkit: string, name: string, description: string) {
    const dir = join(toolkit, ".claude", "skills", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\nBody for ${name}.\n`);
  }

  test("returns an empty array when the toolkit has no .claude/skills directory", () => {
    toolkitDir = mkdtempSync(join(tmpdir(), "toolkit-"));
    expect(discoverSkills(toolkitDir)).toEqual([]);
  });

  test("discovers all SKILL.md files in a toolkit, skipping non-directory entries", () => {
    toolkitDir = mkdtempSync(join(tmpdir(), "toolkit-"));
    writeSkill(toolkitDir, "find-usages", "Find all usages of a symbol.");
    writeSkill(toolkitDir, "rename-symbol", "Rename a symbol across the project.");
    // a stray file alongside the skill directories should be ignored
    writeFileSync(join(toolkitDir, ".claude", "skills", "README.txt"), "not a skill");

    const skills = discoverSkills(toolkitDir);
    const names = skills.map((s) => s.frontmatter.name).sort();
    expect(names).toEqual(["find-usages", "rename-symbol"]);
  });

  test("discoverSkillsForToolkits concatenates skills across multiple toolkit dirs in order", () => {
    const toolkitA = mkdtempSync(join(tmpdir(), "toolkit-a-"));
    const toolkitB = mkdtempSync(join(tmpdir(), "toolkit-b-"));
    try {
      writeSkill(toolkitA, "find-usages", "Find all usages of a symbol.");
      writeSkill(toolkitB, "run-tests", "Run the project's tests.");

      const skills = discoverSkillsForToolkits([toolkitA, toolkitB]);
      expect(skills.map((s) => s.frontmatter.name)).toEqual(["find-usages", "run-tests"]);
    } finally {
      rmSync(toolkitA, { recursive: true, force: true });
      rmSync(toolkitB, { recursive: true, force: true });
    }
  });
});

describe("buildSkillsPromptAddendum", () => {
  test("returns an empty string when there are no skills", () => {
    expect(buildSkillsPromptAddendum([])).toBe("");
  });

  test("lists each skill's name, description, and sandbox SKILL.md path", () => {
    const skills = [
      parseSkillMarkdown(
        `---\nname: find-usages\ndescription: Find all usages of a symbol.\n---\nbody\n`,
        "SKILL.md",
        ".",
      ),
    ];

    const addendum = buildSkillsPromptAddendum(skills);
    expect(addendum).toContain("## Available skills");
    expect(addendum).toContain("**find-usages**: Find all usages of a symbol.");
    expect(addendum).toContain("/app/.claude/skills/find-usages/SKILL.md");
  });

  test("does not name a specific file-reading tool, so it reads naturally for both agent-openrouter and ACP-backed agents", () => {
    const skills = [
      parseSkillMarkdown(
        `---\nname: find-usages\ndescription: Find all usages of a symbol.\n---\nbody\n`,
        "SKILL.md",
        ".",
      ),
    ];

    const addendum = buildSkillsPromptAddendum(skills);
    expect(addendum).not.toContain("readFile");
  });
});
