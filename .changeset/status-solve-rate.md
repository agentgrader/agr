---
"agentgrader": patch
---

`agr status --solve-rate` prints the solve rate as a plain number (e.g. `83.3`) suitable for CI shell conditions (`if [ $(agr status --solve-rate --since 24h) -lt 80 ]; then ...`); combinable with all filter flags (`--since`, `--test-case`, `--config`, `--model`); `--json` emits `{solveRate, passedRuns, failedRuns, totalRuns, dbPath}`; complement to `agr cost` and `agr count` for scriptable analytics
