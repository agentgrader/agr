---
"agentgrader": patch
---

`agr status --by-test-case` shows a per-test-case breakdown: solve rate, avg cost, avg duration, sorted by solve rate ascending (hardest first); combinable with `--since` and `--config` to scope the data; `--json` emits a `byTestCase` array; pairs with `agr bench --only-failed` to identify and re-run the hardest test cases
