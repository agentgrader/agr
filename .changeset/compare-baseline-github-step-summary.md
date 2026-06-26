---
"agentgrader": patch
---

`agr compare-baseline --current baselines/main.json --github-step-summary` appends the Markdown comparison report to `$GITHUB_STEP_SUMMARY`; works with `--format md` (the default); complements `agr bench --github-step-summary` for a complete GitHub Actions step summary showing both the bench result and the regression comparison
