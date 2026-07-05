---
"agentgrader": patch
---

`agr status --p50-cost` and `agr status --p90-cost` print the median/p90 cost per run as a plain 4-decimal number for scripting; `--json` emits `{p50CostUsd,totalRuns}` / `{p90CostUsd,totalRuns}`; complement to `agr cost --percentiles` for single-value shell scripting
