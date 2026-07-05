---
"agentgrader": patch
---

`agr status --zero-pass` lists all test cases that have never produced a passing run, sorted by attempt count (most-tried first); `--json` emits `{zeroPass:[{testCaseId,total,lastRunAt,lastRunId}],count}`; useful for spotting unsolvable or misconfigured test cases
