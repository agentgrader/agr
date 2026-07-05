---
"agentgrader": patch
---

`agr status --run-rate --since 7d` prints average runs per hour over the given window as a plain 2-decimal number; `--json` emits `{runsPerHour,totalRuns,windowHours,window}`; requires `--since`; scriptable: `RATE=$(agr status --run-rate --since 7d)`; useful for throughput analysis and capacity planning
