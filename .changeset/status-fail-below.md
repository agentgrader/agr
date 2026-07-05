---
"agentgrader": patch
---

`agr status --fail-below 0.8` exits with code 1 if the solve rate is below the given threshold (0.0-1.0); prints current rate vs threshold; `--json` emits `{solveRate,threshold,below,passedRuns,totalRuns}`; CI quality gate: `agr status --fail-below 0.8 --since 7d || exit 1`; combinable with `--since`, `--config`, `--test-case`, and all filter flags
