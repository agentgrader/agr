---
"agentgrader": patch
---

`agr count --no-passes` prints the number of distinct test cases with zero passing runs as a plain integer; `--json` emits `{noPasses,totalTestCases,totalRuns}`; CI gate: `if [ $(agr count --no-passes) -gt 0 ]; then alert; fi`; scalar equivalent to `agr status --zero-pass` (which lists the test cases); combinable with `--since`, `--config`, and all filter flags
