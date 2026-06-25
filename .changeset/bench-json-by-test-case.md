---
"agentgrader": patch
---

`agr bench --json` now includes a `byTestCase` array in the output alongside `byConfig`, showing per-test-case pass/fail counts, solve rate, and total cost; `--min-pass-count` is also now wired into the `gateReasons` output; enables downstream tooling to build per-task reports from a single bench JSON output
