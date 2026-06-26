---
"agentgrader": patch
---

`agr status --count` prints total run count as a plain integer for shell scripting: `RUNS=$(agr status --count --since 7d)`; `--json` emits `{totalRuns, passedRuns, failedRuns, erroredRuns}`; complement to `--solve-rate` and `agr cost --total` for building CI budget/gate scripts without parsing full status output
