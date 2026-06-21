---
"agentgrader": patch
---

`agr status --by-test-case --sort-by duration` (also `--by-config`, `--by-model`) sorts the breakdown by avg duration per run descending (slowest first); completes the `--sort-by` field set alongside `solve-rate` (default), `cost`, and `runs`; useful for finding slow test cases or configs that are taking too long
