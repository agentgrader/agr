---
"agentgrader": patch
---

`agr run <name> --repeat N --json` outputs a single JSON object with `passedRuns`, `totalRuns`, `solveRate`, `totalCostUsd`, `avgCostUsd`, `avgDurationMs`, and a `runs` array; previously `--json` was silently ignored when combined with `--repeat`
