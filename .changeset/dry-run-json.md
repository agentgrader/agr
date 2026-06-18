---
"agentgrader": patch
---

`agr bench --dry-run --json` outputs the planned matrix as a JSON object `{testCases, agentConfigs, totalRuns, concurrency}` for CI pipelines that need to inspect what will run before committing to a full bench
