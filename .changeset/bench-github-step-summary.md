---
"agentgrader": patch
---

`agr bench --github-step-summary` appends bench results as Markdown to `$GITHUB_STEP_SUMMARY`, making pass/fail results appear in GitHub Actions step summary pages; includes overall solve rate with status emoji, total cost, and a per-config table when running multiple configs; no-ops with a warning when the env var is not set; add to CI workflows for free bench visibility without any extra tooling
