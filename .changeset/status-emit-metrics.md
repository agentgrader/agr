---
"agentgrader": patch
---

`agr status --emit-metrics` writes current status metrics to `$GITHUB_OUTPUT` (SOLVE_RATE, PASSED_RUNS, FAILED_RUNS, TOTAL_RUNS, TOTAL_COST_USD, AVG_COST_USD, ERRORED_RUNS); also continues to show the normal status output; combinable with `--since` for scoped metrics; complements `agr bench --emit-metrics` for a complete set of GitHub Actions outputs across the bench lifecycle
