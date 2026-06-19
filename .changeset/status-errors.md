---
"agentgrader": patch
---

`agr status --errors` shows a deduplicated list of error messages across errored and failed runs, sorted by frequency; each entry shows count, affected test cases, and an `agr trace <runId>` shortcut for the first occurrence; combinable with `--since`, `--test-case`, `--config`, and all existing filter flags; `--json` emits `{errors: [{message, count, exampleRunId, testCaseIds}]}`
