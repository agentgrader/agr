---
"agentgrader": patch
---

`agr list-tests` now shows a context-aware `Next:` hint: with `--tags` it suggests `agr bench --suite <dir> --tags <tags>`; with multiple results it suggests `agr bench --suite <dir>`; for a single result it suggests `agr run <name>`.
