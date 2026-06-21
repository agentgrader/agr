---
"agentgrader": patch
---

`agr status --by-test-case --rolling 5` computes solve rate using only the most recent 5 runs per test case (newest first); works with `--by-config` and `--by-model` too; useful for evaluating current agent quality without historical failures from early development dragging down the score; combinable with `--min-runs`, `--below`, `--top`, `--sort-by`, `--since`, and all filter flags
