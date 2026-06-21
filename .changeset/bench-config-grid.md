---
"agentgrader": patch
---

`agr bench --suite tasks/ --configs a.yaml,b.yaml --config-grid` prints a PASS/FAIL grid (rows: test cases, columns: agent configs) after the bench completes; only shown when at least 2 configs were run; gives an at-a-glance view of which test cases passed for which configs without needing to separately run `agr status --grid`
