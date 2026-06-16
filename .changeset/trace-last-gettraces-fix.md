---
"agentgrader": patch
---

Fix `agr trace --last --tools` and `agr trace --last` (step display): both were calling `getTraces(db, undefined)` instead of using the resolved run ID, resulting in 0 steps shown when `--last` was used without an explicit run ID.
