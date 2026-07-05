---
"agentgrader": patch
---

`agr count --since-last-pass` prints the number of runs since the most recent passing run as a plain integer; 0 means the latest run passed; `--json` emits `{runsSinceLastPass,lastPassRunId,lastPassAt,totalRuns}`; useful in CI: `if [ $(agr count --since-last-pass) -gt 5 ]; then alert; fi`; combinable with `--test-case`, `--config`, and all filter flags
