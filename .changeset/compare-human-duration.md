---
"agentgrader": patch
---

`agr compare` now shows run duration in human-readable format (`45.0s`, `2m 30s`) instead of raw milliseconds, consistent with `agr trace`. The `formatDuration` helper is now shared from `lib/format-relative-time`.
