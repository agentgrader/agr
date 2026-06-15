import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { type Skill, SkillFrontmatterSchema } from "../schema/toolkit";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parses a SKILL.md file's content into validated frontmatter + body.
 *
 * Throws if the file has no `---`-delimited YAML frontmatter block, or if
 * the frontmatter doesn't satisfy `SkillFrontmatterSchema` (e.g. missing
 * `name`/`description`).
 */
export function parseSkillMarkdown(content: string, path: string, dir: string): Skill {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`SKILL.md at "${path}" is missing a YAML frontmatter block ("---" ... "---")`);
  }

  const [, frontmatterYaml, body] = match;
  const raw = parseYaml(frontmatterYaml);

  let frontmatter: Skill["frontmatter"];
  try {
    frontmatter = SkillFrontmatterSchema.parse(raw);
  } catch (err: any) {
    throw new Error(`Invalid SKILL.md frontmatter in "${path}": ${err.message}`);
  }

  return { frontmatter, body: body.trim(), path, dir };
}

/**
 * Discovers all skills bundled in a toolkit directory, i.e. every
 * `<toolkitDir>/.claude/skills/<skill-name>/SKILL.md`.
 *
 * Returns an empty array if the toolkit has no `.claude/skills` directory.
 */
export function discoverSkills(toolkitDir: string): Skill[] {
  const skillsDir = resolve(toolkitDir, ".claude", "skills");
  if (!existsSync(skillsDir)) return [];

  const skills: Skill[] = [];
  for (const entry of readdirSync(skillsDir)) {
    const dir = join(skillsDir, entry);
    if (!statSync(dir).isDirectory()) continue;

    const skillPath = join(dir, "SKILL.md");
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, "utf-8");
    skills.push(parseSkillMarkdown(content, skillPath, dir));
  }
  return skills;
}

/** Discovers skills across multiple toolkit directories, in order. */
export function discoverSkillsForToolkits(toolkitDirs: string[]): Skill[] {
  return toolkitDirs.flatMap((dir) => discoverSkills(dir));
}

/**
 * Builds a system-prompt addendum that tells the agent which skills are
 * available, mirroring the "progressive disclosure" model used by Claude
 * Agent Skills: only the skill's `name` + `description` are injected up
 * front, and the full SKILL.md body is read on demand once the agent
 * decides a skill is relevant. The addendum deliberately doesn't name a
 * specific tool (e.g. "readFile") for this, since it's sent verbatim to
 * both agent-openrouter (tool named `readFile`) and ACP-backed agents
 * (which have their own file-reading tools).
 *
 * Assumes toolkits are injected into the sandbox at `/app`, so a skill at
 * `<toolkitDir>/.claude/skills/<name>/SKILL.md` is readable at
 * `/app/.claude/skills/<name>/SKILL.md` (see DockerSandboxProvider).
 *
 * Returns an empty string if there are no skills (so callers can append it
 * unconditionally without producing an empty trailing section).
 */
export function buildSkillsPromptAddendum(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const entries = skills
    .map((skill) => {
      const { name, description } = skill.frontmatter;
      const sandboxPath = `/app/.claude/skills/${name}/SKILL.md`;
      return `- **${name}**: ${description}\n  Read \`${sandboxPath}\` for full instructions before using this skill.`;
    })
    .join("\n");

  return [
    "## Available skills",
    "",
    "The sandbox is preloaded with additional tools and documented \"skills\". Each skill below is available in the sandbox; read its SKILL.md for full usage instructions before relying on it.",
    "",
    entries,
  ].join("\n");
}
