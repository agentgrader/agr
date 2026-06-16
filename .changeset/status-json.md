---
"agentgrader": patch
---

`agr status --json` emits machine-readable JSON output for use in CI scripts and shell pipelines; `agr status` now also shows total token counts (`Tokens: N in / M out`) when token data is available in the database.
