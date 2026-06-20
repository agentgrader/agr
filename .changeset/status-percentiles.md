---
"agentgrader": patch
---

`agr status --percentiles` adds p50 and p95 cost and duration stats to the base status output alongside the existing average; `--json` includes `p50CostUsd`, `p95CostUsd`, `p50DurationMs`, `p95DurationMs`; useful for spotting expensive outlier runs that skew the mean cost upward
