---
"agentgrader": patch
---

`agr status --best-config` prints the agent config ID with the highest solve rate as a plain string; `agr status --best-model` does the same for models; `--json` emits `{configId/model, solveRate, total, passed, avgCostUsd}`; combinable with `--since`, `--test-case`, and all filter flags; useful for CI scripts that automatically promote the best-performing config to production
