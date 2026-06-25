---
"agentgrader": patch
---

`agr trace --last --cost-summary` shows total run cost broken down by step kind with percentage and proportional bar chart; `--json` emits `{totalCostUsd, byKind: [{kind, costUsd, pct}]}`; complements `--kind-summary` (step counts) with cost perspective; useful for understanding which step types drive the most spend in a run
