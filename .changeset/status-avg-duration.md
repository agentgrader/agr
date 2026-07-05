---
"agentgrader": patch
---

`agr status --avg-duration` prints the average run duration as a plain integer in milliseconds; `--json` emits `{avgDurationMs,totalRuns}`; scriptable: `AVG=$(agr status --avg-duration --since 7d)`; complement to `--p95-duration` for tracking central tendency vs tail latency; combinable with `--since`, `--config`, `--test-case`, and all filter flags
