---
"agentgrader": patch
---

`agr list-tests --unrun` shows only test cases with no recorded runs in `.agr/db.sqlite`; prints a compact list with name and path; when combined with `--count` prints a bare integer; when combined with `--json` emits a JSON array; useful for finding tasks in a suite that have never been executed; gracefully handles missing DB (treats all test cases as unrun)
