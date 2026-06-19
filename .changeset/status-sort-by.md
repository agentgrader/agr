---
"agentgrader": patch
---

`agr status --by-test-case --sort-by cost` (and `--by-config`, `--by-model`) sorts breakdowns by avg cost/run descending (most expensive first); also supports `--sort-by runs` (most runs first); default remains `solve-rate` (hardest/best first); useful for cost optimization and identifying which test cases or configs consume the most budget
