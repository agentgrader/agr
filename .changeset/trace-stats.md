---
"agentgrader": patch
---

`agr trace --last --stats` shows a compact token and cost statistics summary: total/avg/max tokens per step, prompt cache hit rate, and total cost; `--json` emits `{totalSteps, totalIn, totalOut, totalCached, avgIn, avgOut, maxIn, maxOut, cacheHitPct, totalCostUsd}`; useful for quickly understanding token usage patterns without reading the full trace
