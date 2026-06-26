---
"agentgrader": patch
---

`agr status --best-test-case` prints the test case ID with the highest solve rate as a plain string; `--json` emits `{testCaseId, solveRate, total, passed, avgCostUsd}`; complement to `--worst-test-case`; useful for identifying the easiest or most stable test case in your eval suite
