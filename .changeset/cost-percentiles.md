---
"agentgrader": patch
---

`agr cost --percentiles` prints p50/p90/p95/p99 cost distribution across all matching runs plus min/max; `--json` emits `{total,totalCostUsd,p50,p90,p95,p99,min,max}`; useful for understanding cost spread and identifying expensive outliers before setting budgets
