---
"agentgrader": patch
---

`agr status --worst-config` and `agr status --worst-model` print the agent config ID / model name with the lowest solve rate as plain strings; `--json` emits `{configId, solveRate, ...}` / `{model, solveRate, ...}`; complement the existing `--best-config` / `--best-model` options for identifying underperforming configs or models in A/B bench results
