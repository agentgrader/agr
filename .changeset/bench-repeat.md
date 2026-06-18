---
"agentgrader": patch
---

`agr bench --repeat <n>` runs each test case N times per config to measure solve rate with statistical significance; useful for pass@k metrics and detecting flaky tests (e.g. `--repeat 5` runs 5 trials per test case and the result summary shows the overall solve rate across all trials)
