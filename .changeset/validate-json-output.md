---
"agentgrader": patch
---

`agr validate --json` outputs validation results as a single JSON object with `passed`, `passedCount`, `totalCount`, and a `results` array (per-test-case: `name`, `path`, `ok`, `checks[]`); suppresses per-check console output for scripting and CI pipelines
