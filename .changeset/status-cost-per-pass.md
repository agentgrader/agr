---
"agentgrader": patch
---

`agr status --cost-per-pass` prints total cost divided by passing run count as a plain 4-decimal number (true cost-to-success metric); returns `-1` when no passing runs exist; `--json` emits `{costPerPassUsd,totalCostUsd,passedRuns,totalRuns}`; scriptable: `CPP=$(agr status --cost-per-pass --since 7d)`; useful for comparing configs by effective cost
