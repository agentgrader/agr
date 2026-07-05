---
"agentgrader": patch
---

`agr status --p95-duration` prints the 95th-percentile run duration as a plain integer in milliseconds; `--json` emits `{p95DurationMs,totalRuns}`; useful for SLA alerting: `if [ $(agr status --p95-duration) -gt 300000 ]; then alert; fi`; combinable with `--since`, `--config`, and all filter flags; complement to `--percentiles` for single-value scripting
