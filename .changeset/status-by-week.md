---
"agentgrader": patch
---

`agr status --by-week` shows a per-calendar-week breakdown (runs, solve rate, total cost) sorted oldest first; higher-level view than `--by-day` for long-running eval suites; weeks are labeled `YYYY-Www`; combinable with `--since`, `--top`, `--test-case`, `--config`, and all filter flags; `--json` emits `{byWeek: [{week, total, passed, failed, solveRate, totalCostUsd, avgCostUsd}]}`
