---
"agentgrader": patch
---

`agr status --budget-remaining <amount>` prints the budget minus total cost as a 4-decimal number; negative means over budget; `--json` emits `{budgetRemainingUsd,totalCostUsd,budgetUsd}`; scriptable: `REMAINING=$(agr status --budget-remaining 10.00 --since 7d)` then `if (( $(echo "$REMAINING < 0" | bc) )); then alert; fi`; combinable with `--since`, `--config`, and all filter flags
