---
"agentgrader": patch
---

`agr count --by-test-case` prints run counts per test case sorted by total runs (plain: tab-separated `total\ttestCaseId\t(N passed, M failed)`; JSON: `{total, byTestCase: [{testCaseId, total, passed, failed}]}`); `agr count --by-config` does the same per agent config; combinable with `--since`, `--passed`, `--failed`, and all filter flags; useful in CI scripts to find test cases with too few runs for statistical significance (`--by-test-case --json | jq '.byTestCase[] | select(.total < 3)'`)
