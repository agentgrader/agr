---
"agentgrader": patch
---

`agr status --error-rate` prints the fraction of errored runs (sandbox crash / no pass/fail score) as a plain 4-decimal number from `0.0000` to `1.0000`; `--json` emits `{errorRate,erroredRuns,totalRuns}`; combinable with `--since`, `--config`, and all filter flags; useful for CI alerting on infrastructure health
