---
"agentgrader": patch
---

`agr export runs --format csv` writes a CSV file with one row per run; all fields (`id`, `testCaseId`, `agentConfigId`, `passed`, `costUsd`, `durationMs`, `stepsCount`, `tokensIn`, `tokensOut`, `matrixId`, `metrics`) are included as columns; `metrics` is JSON-serialized; default filename is `export-runs.csv`
