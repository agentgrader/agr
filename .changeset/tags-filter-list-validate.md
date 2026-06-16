---
"agentgrader": patch
---

Propagate `--tags` filtering to `agr list-tests` and `agr validate --suite`: both commands now accept `--tags <comma-separated>` to scope output or validation to test cases whose `tags:` list overlaps with the requested tags. `agr list-tests --json` output also includes the `tags` array when present. `TestCaseSummary` gains an optional `tags` field.
