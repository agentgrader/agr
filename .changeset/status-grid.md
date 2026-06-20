---
"agentgrader": patch
---

`agr status --grid` shows a cross-tab matrix with test cases as rows and agent configs as columns; each cell shows the latest PASS, FAIL, or `--` (no run) for that pair; combinable with `--since`, `--test-case`, `--config`, and all filter flags; `--json` emits `{testCaseIds, configIds, grid: [{testCaseId, configs: {configId: boolean|null}}]}`; useful for seeing coverage and regressions across multiple configs at a glance
