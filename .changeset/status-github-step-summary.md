---
"agentgrader": patch
---

`agr status --github-step-summary` appends a Markdown status summary to `$GITHUB_STEP_SUMMARY`; shows overall pass rate with emoji, total cost, and avg cost; no-op with warning when env var is not set; `agr init --ci` now uses this in the always-running summary step so CI dashboards show eval state even when the bench step fails
