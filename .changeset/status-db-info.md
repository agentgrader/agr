---
"agentgrader": patch
---

`agr status --db-info` prints a database overview: file size, total run count, unique test case count, unique config count, and date range of runs; suggests `agr prune` when the DB exceeds 50 MB; `--json` emits `{dbPath, sizeMb, totalRuns, uniqueTestCases, uniqueConfigs, oldestRun, newestRun}`; great starting point for understanding an unfamiliar eval setup
