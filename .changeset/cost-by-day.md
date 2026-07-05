---
"agentgrader": patch
---

`agr cost --by-day` shows a daily cost breakdown; optional N groups runs into N-day windows; prints `date\ttotalCostUsd\tavgCostUsd\truns` per row oldest first; `--json` emits `{days,totalCostUsd,byDay:[{date,totalCostUsd,avgCostUsd,runs}]}`; useful for burn-rate tracking: `agr cost --by-day --since 30d`; combinable with `--since`, `--config`, `--test-case`, and all filter flags
