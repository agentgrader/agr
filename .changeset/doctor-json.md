---
"agentgrader": patch
---

`agr doctor --json` outputs environment check results as a single JSON object with `passed`, `failureCount`, `warningCount`, and `checks[]` (per-check `label`, `status`, `detail`); useful in setup scripts and CI initialization workflows
