---
"agentgrader": patch
---

`agr count --unique-configs` prints the number of unique agent configs in the filtered run set as a plain integer; `--json` emits `{uniqueConfigs,totalRuns}`; scriptable: `CFGS=$(agr count --unique-configs --since 7d)`; complement to `agr count --unique-test-cases`
