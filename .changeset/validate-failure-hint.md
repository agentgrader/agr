---
"agentgrader": patch
---

`agr validate` now prints a fix-and-rerun instruction when validation fails, matching the `agr validate-toolkit` behavior. Single-case failures show `agr validate <name>`; multi-case failures list only the failing names (or `--suite <dir>` when all failed).
