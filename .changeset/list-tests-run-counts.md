---
"agentgrader": patch
---

`agr list-tests --run-counts` shows run counts (total, passed, failed) alongside each test case in the suite, sorted fewest runs first; `0 runs [unrun]` marks never-executed cases; `--json` adds `runs`, `passed`, `failed` fields to each test case entry; useful for identifying under-covered test cases and planning where to run more bench iterations
