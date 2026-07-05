---
"agentgrader": patch
---

`agr cost --stddev` prints the cost standard deviation as a plain 4-decimal number; `--json` emits `{stddevCostUsd,avgCostUsd,totalRuns}`; cost stability metric: low stddev means predictable cost per run; scriptable: `SD=$(agr cost --stddev --since 7d)`; combinable with `--since`, `--config`, `--test-case`, and all filter flags
