---
"agentgrader": patch
---

`agr validate` now accepts `--suite <dir>` to validate every test case found recursively under a directory, without having to list names explicitly. Mirrors `agr bench --suite`. Useful in CI as `agr validate --suite tasks/ --strict`.
