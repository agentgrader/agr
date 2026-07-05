---
"agentgrader": patch
---

`agr status --cost-delta --since 7d` prints avg-cost-per-run change vs the prior equal-length window as a signed 4-decimal number (e.g. `+0.0023` or `-0.0010`); `--json` emits `{costDeltaUsd,currentAvgCostUsd,previousAvgCostUsd,window}`; scriptable: `CDELTA=$(agr status --cost-delta --since 7d)`; complement to `--pass-delta` for budget trend analysis
