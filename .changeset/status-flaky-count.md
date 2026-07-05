---
"agentgrader": patch
---

`agr status --flaky-count` prints the number of flaky test cases (those with both passing and failing runs across all history) as a plain integer; `--json` emits `{flakyCount,totalTestCases}`; scriptable: `FLAKY=$(agr status --flaky-count)`; complement to `agr status --flaky` which shows full details
