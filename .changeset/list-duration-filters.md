---
"agentgrader": patch
---

`agr list --min-duration <ms>` and `--max-duration <ms>` filter runs by wall-clock duration in milliseconds; `--min-duration 60000` finds runs taking over a minute (slow or stalled agents); `--max-duration 5000` finds runs that terminated very early; combinable with all existing list filters and `--plain`/`--json`; completes the set of numeric range filters alongside `--min-cost/--max-cost` and `--min-steps/--max-steps`
