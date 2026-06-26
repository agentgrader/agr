---
"agentgrader": patch
---

`agr status --report-card` prints a comprehensive health check combining: overall summary stats, regression count (test cases with consecutive failures after prior passes), and flaky test count; `--json` emits `{summary, regressions, flaky}`; useful as a quick "how is my eval suite doing?" overview without needing to run multiple commands
