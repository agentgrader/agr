---
"agentgrader": patch
---

`agr status --first-run-at` prints the ISO timestamp of the oldest matching run; `--json` emits `{firstRunAt,runId,totalRuns}`; useful for suite age checks: `AGE=$(agr status --first-run-at --test-case hello-world)`; complement to `--last-run-id` for bounding the time range of a test suite; combinable with `--since`, `--config`, `--test-case`, and all filter flags
