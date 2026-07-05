---
"agentgrader": patch
---

`agr cost --last-run` prints the cost of the most recent matching run as a plain 4-decimal number; `--json` emits `{costUsd,runId,testCaseId,agentConfigId}`; scriptable: `LAST=$(agr cost --last-run)`; combinable with `--test-case`, `--config`, and all filter flags; useful for monitoring cost after a single run
