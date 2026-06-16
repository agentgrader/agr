---
"agentgrader": patch
---

Warn when `--tags` is passed to `agr bench` or `agr validate` without `--suite`: previously the flag silently had no effect; now prints `Warning: --tags has no effect without --suite`.
