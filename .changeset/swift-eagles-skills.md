---
"@agentgrader/agent-openrouter": minor
"@agentgrader/core": patch
---

agent-openrouter now registers each toolkit skill (`.claude/skills/<name>/SKILL.md`, backed by `bin/<name>`) as its own first-class tool named `tool_<name>` (hyphens become underscores), with the skill's description and an `args` passthrough param, executing `<name> <args>` in the sandbox. Per `JETBRAINS_FEEDBACK.md` iteration 76 (7th confirming variant), `claude-haiku-4-5-20251001` reliably calls tools that appear in its real tool list (`readFile`/`writeFile`/`executeCommand`/`submit`) but does not invoke toolkit commands that are only *described* in the system prompt and run via `executeCommand <name> <args>` - registering them as first-class tools gives these commands the same adoption odds as built-in tools. `run-single.ts` now always propagates the merged toolkit list via `effectiveConfig.toolkits`, so adapters can call `discoverSkillsForToolkits` independently of whether the system-prompt addendum was built.
