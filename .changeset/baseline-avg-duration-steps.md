---
"agentgrader": patch
---

`agr bench --save-baseline` snapshots now record `avgDurationMs` and `avgStepsCount` in their aggregates. `agr compare-baseline` Markdown output now shows `Avg duration` and `Avg steps` rows with percentage deltas alongside solve rate and avg cost.
