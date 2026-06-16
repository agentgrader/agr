---
"agentgrader": patch
---

`agr export traces --test-case <name>` exports traces for all matching runs of a test case without requiring a run ID; `--config`, `--since`, `--passed`, and `--limit` also filter multi-run trace exports; `agr export traces --last --test-case <name>` now correctly scopes to the most recent run for that test case (was silently ignoring `--test-case` before)
