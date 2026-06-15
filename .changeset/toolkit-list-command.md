---
"agentgrader": minor
---

Add `agr toolkit-list <dir>` command: lists a toolkit's `bin/` tools alongside their `.claude/skills/<name>/SKILL.md` descriptions, flagging tools with no skill doc. With `--check-config <agent.yaml>`, diffs the toolkit's `bin/` tools against that config's `track_tools`/`require_tools_before_submit` (including matrix files' `base:`-nested lists), surfacing tools that exist in the toolkit but aren't tracked by a given agent config, and vice versa.
