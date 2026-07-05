---
"agentgrader": patch
---

`agr status --cheapest-config` prints the agent config ID with the lowest average cost per run; `--most-expensive-config` prints the most expensive; both emit `{configId,avgCostUsd,total,totalCostUsd}` with `--json`; useful for cost triage when comparing multiple configs
