---
"agentgrader": patch
---

`agr compare --json` outputs the comparison as a single JSON object `{runA, runB, divergentCount, totalSteps, firstDivergence, steps[]}` for scripting and CI pipelines; combinable with `--last-two`, `--test-case`, and `--config`
