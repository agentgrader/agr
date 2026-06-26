---
"agentgrader": patch
---

`agr bench --emit-metrics` writes key bench metrics to `$GITHUB_OUTPUT` (SOLVE_RATE, PASSED_RUNS, FAILED_RUNS, TOTAL_RUNS, TOTAL_COST_USD, AVG_COST_USD); enables downstream GitHub Actions steps to read metrics via `steps.<id>.outputs.SOLVE_RATE` and make conditional decisions (e.g. skip deployment if solve rate dropped)
