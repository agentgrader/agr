---
"agentgrader": patch
---

`agr status --by-day` shows a per-day breakdown (runs, solve rate, total cost) sorted oldest-first; useful for spotting when a regression started across a multi-day bench period; combinable with `--since`, `--top`, `--test-case`, `--config`, `--model`, `--sandbox`; `--json` emits `{byDay: [{day, total, passed, failed, solveRate, totalCostUsd, avgCostUsd}]}`
