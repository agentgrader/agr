---
"agentgrader": patch
---

`agr cost --by-test-case` prints cost breakdown per test case sorted most expensive first (plain: tab-separated `$total\ttestCaseId\t(N runs, avg $X/run)`; JSON: `{total, totalCostUsd, byTestCase: [{testCaseId, total, totalCostUsd, avgCostUsd}]}`); `agr cost --by-config` does the same per agent config; combinable with all existing cost filters (`--since`, `--passed`, `--last-matrix`, etc.)
