import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
