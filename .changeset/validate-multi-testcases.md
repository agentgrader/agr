---
"agentgrader": minor
---

`agr validate` now accepts multiple test case names/paths in one invocation (`agr validate task-a task-b task-c --strict`). Each is validated in turn; the command exits 1 if any fail and prints a summary (`N/M validations passed`). Single-case behaviour is unchanged.
