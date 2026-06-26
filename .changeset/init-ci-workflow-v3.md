---
"agentgrader": patch
---

`agr init --ci` now generates an enhanced GitHub Actions workflow that: (1) uses `--output-json bench-result.json` to save a machine-readable result file, (2) adds a "Check for regressions" step using `agr status --regression --fail-on-regression` (always runs), (3) uploads `bench-result.json` as a CI artifact for downstream tooling
