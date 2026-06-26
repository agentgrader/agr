---
"agentgrader": patch
---

`agr doctor` now includes two additional DB health checks: **Stuck runs** (warns when any run has been in "running" status for more than 2 hours, suggesting a hung sandbox) and **Regressions** (warns when test cases have regressed — 3+ consecutive failures after historical passes — pointing to `agr status --regression` for details)
