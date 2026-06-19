---
"agentgrader": patch
---

`agr toolkit-list --json` outputs a structured JSON object `{toolkitDir, tools[], auditFindings[], ok}` for CI scripting; with `--check-config` also includes `{untracked[], trackedButMissing[], checkConfig}`; combinable with `jq .ok` for pass/fail gating in pipelines
