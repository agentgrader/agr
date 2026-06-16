---
"agentgrader": patch
---

`agr trace` now accepts `--last` to inspect the most recent run in `.agr/db.sqlite` without copying a UUID. Works with `--tools` and `--quality`: `agr trace --last --tools`. The `[runId]` argument is now optional when `--last` is given.
