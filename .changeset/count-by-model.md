---
"agentgrader": patch
---

`agr count --by-model` prints run counts per model (total, passed, failed, solve rate %), sorted by most runs first; JSON: `{total, byModel: [{model, total, passed, failed, solveRate}]}`; completes the count breakdown set alongside `--by-test-case` and `--by-config`
