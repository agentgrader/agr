---
"agentgrader": patch
---

`agr init --ci` now generates an updated GitHub Actions workflow that uses `--github-step-summary` (bench results appear in the Actions step summary page), `--show-failures` (compact failure list at the end), and a final `agr status --summary` step (always runs even on failure to show overall state); the generated workflow is a better starting point for CI integration
