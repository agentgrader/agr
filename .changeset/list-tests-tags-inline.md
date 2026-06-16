---
"agentgrader": patch
---

Show tags inline in `agr list-tests` and `agr bench --dry-run` output: when any test case in the set has tags, each row prints its tags in `[tag1, tag2]` form at the end of the line. Rows without tags stay clean. Also updates `agr init` step 3 to suggest `agr trace --last` instead of requiring a runId.
