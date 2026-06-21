---
"agentgrader": patch
---

`agr bench --show-failures` prints a compact list of failing test cases after the bench completes, including each run ID as an `agr trace <id>` shortcut and up to 80 characters of the error message; avoids having to separately run `agr status --by-test-case --below 100` to identify which tasks to investigate
