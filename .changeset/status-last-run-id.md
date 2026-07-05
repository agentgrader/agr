---
"agentgrader": patch
---

`agr status --last-run-id` prints the ID of the most recent matching run as a plain string; `--json` emits `{runId,testCaseId,createdAt}`; scriptable: `ID=$(agr status --last-run-id) && agr trace $ID`; `agr status --last-pass-id` prints the most recent passing run ID; combinable with `--test-case`, `--config`, and all filter flags
