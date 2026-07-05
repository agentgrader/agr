---
"agentgrader": patch
---

`agr status --streak <testCaseId>` prints the current consecutive pass/fail/error streak for a specific test case; `--json` emits `{testCaseId,streak,streakKind,totalRuns,passRate}`; useful for checking whether a flaky test is currently on a passing or failing streak before deciding to re-run
