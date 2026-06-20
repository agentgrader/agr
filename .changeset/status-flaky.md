---
"agentgrader": patch
---

`agr status --flaky` shows test cases that have both passes and failures across their run history, sorted closest-to-50/50 first; each entry shows total runs, pass/fail counts, solve rate, and avg cost; combinable with `--since`, `--config`, `--model`, `--top`, and all filter flags; `--json` emits `{flaky: [{testCaseId, total, passed, failed, solveRate, avgCostUsd, variance}]}`; useful for identifying eval cases that need more runs to be statistically reliable
