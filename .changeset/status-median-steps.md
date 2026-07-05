---
"agentgrader": patch
---

`agr status --median-steps` prints the median (p50) step count per run as a plain integer; more robust than `--avg-steps` when outlier long runs skew the mean; `--json` emits `{medianSteps,totalRuns}`; scriptable: `MED=$(agr status --median-steps)`
