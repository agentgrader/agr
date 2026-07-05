---
"agentgrader": patch
---

`agr cost --percentile N` prints an arbitrary cost percentile (0-100) as a plain 4-decimal number; `--json` emits `{percentile,costUsd,totalRuns}`; scriptable: `P75=$(agr cost --percentile 75 --since 7d)`; complement to `--percentiles` (which prints p50/p90/p95/p99 together) for single-value scripting; combinable with `--since`, `--config`, `--test-case`, and all filter flags
