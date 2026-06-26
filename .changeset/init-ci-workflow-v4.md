---
"agentgrader": patch
---

`agr init --ci` now generates a v4 workflow that: (1) gives the bench step an `id: bench` so outputs are accessible in subsequent steps, (2) adds `--emit-metrics` to the bench step so `steps.bench.outputs.SOLVE_RATE` etc. are available for conditional logic, (3) adds `--emit-metrics` to the summary step for final status metrics
