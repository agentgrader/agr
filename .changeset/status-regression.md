---
"agentgrader": patch
---

`agr status --regression` finds test cases that have regressed: they have at least one historical passing run but their most recent N consecutive runs all failed (N = 3 by default, override with `--regression-window N`); shows the last pass timestamp and last run ID for quick trace access; `--json` emits `{regressions: [{testCaseId, recentFails, lastPassAt, lastRunId}]}`
