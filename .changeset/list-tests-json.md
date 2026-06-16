---
"agentgrader": patch
---

`agr list-tests` now accepts `--json` to print results as a JSON array (`name`, `path`, `relativePath`, optional `description`) instead of a human-readable table. Useful for CI scripts that enumerate test cases without parsing columnar output.
