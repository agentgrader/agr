---
"agentgrader": patch
---

`agr status --by-test-case --show-last-pass` appends the relative time of the most recent passing run to each row (e.g. `last pass: 2h ago`); shows `last pass: never` for test cases with no passing runs; `lastPassAt` is also included in `--json` output; useful for identifying test cases that haven't passed recently even if their historical solve rate looks OK
