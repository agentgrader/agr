---
"agentgrader": patch
---

`agr status --by-test-case --min-runs 5` filters breakdowns to only show entries with at least N total runs; works with `--by-config` and `--by-model` too; combinable with `--below`, `--top`, `--sort-by`, `--since`, and all filter flags; useful for excluding test cases that haven't been run enough to produce statistically meaningful solve rates
