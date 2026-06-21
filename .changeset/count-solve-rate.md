---
"agentgrader": patch
---

`agr count --by-test-case --json` and `--by-config --json` now include `solveRate` (0-100) in each entry alongside `total`, `passed`, and `failed`; plain text output also shows the solve rate percentage; enables `jq '.byTestCase[] | select(.solveRate < 50)'` without needing arithmetic
