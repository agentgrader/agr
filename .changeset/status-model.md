---
"agentgrader": patch
---

`agr status --model <substring>` restricts the DB summary to runs where the agent model contains the given substring (case-insensitive); mirrors `agr list --model` for consistent filter symmetry across analytics commands (e.g. `agr status --model haiku --by-config`)
