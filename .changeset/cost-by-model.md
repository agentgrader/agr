---
"agentgrader": patch
---

`agr cost --by-model` prints cost breakdown per model (total cost, run count, avg cost/run), sorted most expensive first; JSON: `{total, totalCostUsd, byModel: [{model, total, totalCostUsd, avgCostUsd}]}`; completes the cost command breakdown set alongside `--by-test-case` and `--by-config`
