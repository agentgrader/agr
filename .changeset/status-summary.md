---
"agentgrader": patch
---

`agr status --summary` prints a compact one-liner with all key stats, e.g. `127 runs: 89 PASS (70%)  |  $1.2345 total  avg: $0.0097/run  |  last: 2m ago`; `--json` emits `{totalRuns, passedRuns, failedRuns, solveRate, totalCostUsd, avgCostUsd, lastRunAt, dbPath}`; combinable with all filter flags; great for shell prompts and CI log prefixes
