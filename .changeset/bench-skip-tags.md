---
"agentgrader": patch
---

`agr bench --suite tasks/ --skip-tags slow` excludes test cases with any of the specified tags from the run; applied after `--tags` so you can include a broad set and then exclude a subset; prints a warning when used without `--suite`
