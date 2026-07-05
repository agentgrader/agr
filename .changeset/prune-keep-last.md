---
"agentgrader": patch
---

`agr prune --keep-last 5 --yes` keeps only the 5 most recent runs per test case and deletes the rest; useful for trimming a large database to a rolling window without losing recent history; combines with `--dry-run` to preview: `agr prune --keep-last 10 --dry-run`; can be combined with `--test-case` or `--config` to scope the trim
