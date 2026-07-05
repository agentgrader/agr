---
"agentgrader": patch
---

`agr cost --min` and `agr cost --max` print the minimum/maximum cost across matching runs as a plain 4-decimal number; combinable together for range output; `--json` emits `{minCostUsd,totalRuns}` / `{maxCostUsd,totalRuns}`; useful for spotting outliers: `MAX=$(agr cost --max --since 24h)`; combinable with `--since`, `--config`, `--test-case`, and all filter flags
