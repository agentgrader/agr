---
"agentgrader": patch
---

`agr status --top-regressions N` prints the N test cases with the longest consecutive-failure streak, sorted worst-first; useful for CI triage dashboards and quick prioritization; combines with `--regression-window` to set minimum streak threshold; `--json` emits `{topRegressions:[{testCaseId,streak,lastPassAt,lastRunId}]}`
