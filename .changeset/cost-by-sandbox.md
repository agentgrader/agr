---
"agentgrader": patch
---

`agr cost --by-sandbox` prints total and average cost per sandbox provider sorted by total spend; complements `agr status --by-sandbox` with a pure cost view; useful for comparing docker vs e2b expenditure; `--json` emits `{total, totalCostUsd, bySandbox:[{sandbox,total,totalCostUsd,avgCostUsd}]}`
