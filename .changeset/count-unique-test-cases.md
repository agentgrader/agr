---
"agentgrader": patch
---

`agr count --unique-test-cases` prints the number of unique test cases in the filtered run set as a plain integer; `--json` emits `{uniqueTestCases,totalRuns}`; combinable with `--since`, `--config`, and all filter flags; scriptable: `TCS=$(agr count --unique-test-cases --since 7d)`
