---
"agentgrader": patch
---

`agr bench --print-passed` prints only the run IDs of passing runs to stdout (one per line); `agr bench --print-failed` does the same for failing/errored runs; both complement `--print-ids` for filtered pipeline use cases (e.g. piping failing run IDs to `xargs agr trace` for investigation)
