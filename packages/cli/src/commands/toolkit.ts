import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { discoverSkills, auditToolkitDirectory } from "@agentgrader/core";
import { parse as parseYaml } from "yaml";

function binTemplate(name: string): string {
  return `#!/bin/sh
# ${name} - TODO: describe what this tool does and which JetBrains/IDE
# action it approximates.
#
# Usage: ${name} <args...>

set -e

if [ -z "$1" ]; then
  echo "Usage: ${name} <args...>" >&2
  exit 1
fi

# TODO: implement the tool. Print "file:line: message" for findings, one
# per line, to match the style of other toolkit tools (e.g. inspect-code).
echo "${name}: not yet implemented" >&2
exit 1
`;
}

function skillTemplate(name: string): string {
  return `---
name: ${name}
description: TODO - one sentence describing when an agent should use this tool and what IDE action it approximates.
allowed-tools:
  - executeCommand
---

# ${name}

\`${name}\` is a small CLI tool, available on \`PATH\` inside the sandbox.

TODO: describe what it does.

## When to use it

TODO

## Usage

Run it via the \`executeCommand\` tool:

\`\`\`
${name} <args...>
\`\`\`

## Example

\`\`\`
$ ${name} <args...>
TODO
\`\`\`
`;
}

/**
 * `agr toolkit-add <name> [--dir <toolkitDir>]`
 *
 * Scaffolds a new toolkit tool: a `bin/<name>` shell script template plus a
 * matching `.claude/skills/<name>/SKILL.md` template, following the layout
 * documented in /advanced/acp-agent.md and used by toolkits/jetbrains-tools
 * in bestagenttrainer. Both files are stubs - fill in the implementation and
 * description, then reference `<toolkitDir>` from `toolkits:` in an agent
 * config or test case.
 */
export async function toolkitAddCommand(name: string, opts: { dir?: string }) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`Invalid tool name "${name}": use lowercase letters, digits, and hyphens (e.g. "find-usages").`);
  }

  const toolkitDir = resolve(opts.dir || "./toolkit");
  const binDir = resolve(toolkitDir, "bin");
  const skillDir = resolve(toolkitDir, ".claude/skills", name);
  const binPath = resolve(binDir, name);
  const skillPath = resolve(skillDir, "SKILL.md");

  if (existsSync(binPath)) {
    throw new Error(`${binPath} already exists.`);
  }
  if (existsSync(skillPath)) {
    throw new Error(`${skillPath} already exists.`);
  }

  mkdirSync(binDir, { recursive: true });
  mkdirSync(skillDir, { recursive: true });

  writeFileSync(binPath, binTemplate(name), { mode: 0o755 });
  writeFileSync(skillPath, skillTemplate(name));

  console.log(`Scaffolded toolkit tool "${name}" in ${toolkitDir}`);
  console.log("");
  console.log("Created:");
  console.log(`  ${binPath}  (executable stub)`);
  console.log(`  ${skillPath}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Implement the tool in ${binPath}.`);
  console.log(`  2. Fill in the description and usage in ${skillPath}.`);
  console.log(`  3. Reference "${toolkitDir}" from \`toolkits:\` in an agent config or test case.`);
}

/**
 * `agr toolkit-list <dir> [--check-config <agent.yaml>]`
 *
 * Lists every `bin/<name>` script in a toolkit directory alongside its
 * `.claude/skills/<name>/SKILL.md` description (if any), so a toolkit
 * author can audit what's actually shippable from `<dir>` before
 * referencing it via `toolkits:`.
 *
 * With `--check-config <agent.yaml>`, also diffs the toolkit's `bin/`
 * scripts against that config's `track_tools` (and
 * `require_tools_before_submit`) lists - this is the gap that bit
 * `matrix-jetbrains-toolkits.yaml` repeatedly (new tools like `add-import`
 * and `find-test-file` were added to `bin/` and to one agent config's
 * `track_tools`, but not to every config that references the same
 * toolkit).
 */
export async function toolkitListCommand(toolkitDir: string, opts: { checkConfig?: string }) {
  const dir = resolve(toolkitDir);
  const binDir = resolve(dir, "bin");

  if (!existsSync(binDir)) {
    throw new Error(`${binDir} does not exist - is "${toolkitDir}" a toolkit directory (with a bin/ subdir)?`);
  }

  const toolNames = readdirSync(binDir)
    .filter((entry) => {
      const stat = statSync(resolve(binDir, entry));
      // Executable bit excludes non-tool files that happen to live in bin/
      // (e.g. tools.test.ts).
      return stat.isFile() && (stat.mode & 0o111) !== 0;
    })
    .sort();

  const skills = discoverSkills(dir);
  const descriptionByName = new Map(skills.map((skill) => [skill.frontmatter.name, skill.frontmatter.description]));

  console.log(`Tools in ${toolkitDir}:`);
  for (const name of toolNames) {
    const description = descriptionByName.get(name);
    if (description) {
      console.log(`  ${name.padEnd(22)} ${description}`);
    } else {
      console.log(`  ${name.padEnd(22)} (no .claude/skills/${name}/SKILL.md)`);
    }
  }
  const withSkill = toolNames.filter((name) => descriptionByName.has(name)).length;
  console.log("");
  console.log(`${toolNames.length} tool(s), ${withSkill} with SKILL.md.`);

  const findings = auditToolkitDirectory(dir);
  if (findings.length > 0) {
    console.log("");
    console.log("Security audit:");
    for (const finding of findings) {
      const label = finding.severity === "error" ? "FAIL" : "WARN";
      console.log(`  [${label}] ${finding.rule}: ${finding.message}`);
    }
  }

  if (!opts.checkConfig) return;

  const configContent = readFileSync(resolve(opts.checkConfig), "utf-8");
  const config = parseYaml(configContent) as {
    track_tools?: string[];
    require_tools_before_submit?: string[];
    // --matrix files nest agent-config fields under `base:` instead of at
    // the top level.
    base?: { track_tools?: string[]; require_tools_before_submit?: string[] };
  };
  const tracked = new Set([
    ...(config.track_tools ?? []),
    ...(config.require_tools_before_submit ?? []),
    ...(config.base?.track_tools ?? []),
    ...(config.base?.require_tools_before_submit ?? []),
  ]);

  const untracked = toolNames.filter((name) => !tracked.has(name));
  const trackedButMissing = [...tracked].filter((name) => !toolNames.includes(name));

  console.log("");
  console.log(`Checking against ${opts.checkConfig} (track_tools + require_tools_before_submit):`);
  if (untracked.length > 0) {
    console.log(`  In ${toolkitDir}/bin/ but not tracked: ${untracked.join(", ")}`);
  } else {
    console.log("  All toolkit tools are tracked.");
  }
  if (trackedButMissing.length > 0) {
    console.log(`  Tracked but not in ${toolkitDir}/bin/: ${trackedButMissing.join(", ")}`);
  }
}
