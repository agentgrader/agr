---
"agentgrader": patch
---

Add `agr toolkit-add <name> [--dir <toolkitDir>]`: scaffolds a new toolkit tool as a `bin/<name>` shell script stub plus a matching `.claude/skills/<name>/SKILL.md` stub, following the layout used by `toolkits/jetbrains-tools`. Both files are TODO-filled templates - implement the script and fill in the skill description, then reference `<toolkitDir>` from `toolkits:` in an agent config or test case. Previously, adding a new toolkit tool meant hand-copying an existing `bin/`+`SKILL.md` pair and editing every reference.
