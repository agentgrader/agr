---
"agentgrader": patch
---

`agr status --worst-test-case` prints the test case ID with the lowest solve rate as a plain string; `--json` emits `{testCaseId, solveRate, total, passed, avgCostUsd}`; complement to `--best-config`; useful in CI scripts for identifying the hardest test case: `HARDEST=$(agr status --worst-test-case)`
