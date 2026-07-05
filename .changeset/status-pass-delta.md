---
"agentgrader": patch
---

`agr status --pass-delta --since 7d` prints the solve-rate change in percentage points vs the prior equal-length window as a signed plain number (e.g. `+5.2` or `-3.1`); `--json` emits `{passDeltaPp,currentSolveRate,previousSolveRate,window,totalRuns,prevTotalRuns}`; scriptable: `DELTA=$(agr status --pass-delta --since 7d)`; more concise than `--trend` when only the delta is needed
