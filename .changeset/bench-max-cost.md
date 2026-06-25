---
"agentgrader": patch
---

`agr bench --max-cost 1.50` exits with code 1 if the total bench cost exceeds $1.50; the reason is printed alongside other gate failures; useful as a budget gate in CI to prevent runaway spend on large bench runs; combinable with `--min-solve-rate`, `--min-pass-count`, and `--fail-on-failure`
