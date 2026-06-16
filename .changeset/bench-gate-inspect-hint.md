---
"agentgrader": patch
---

`agr bench` now prints `Inspect:` instead of `Next:` when a CI gate fires (`--fail-on-failure`, `--min-solve-rate`), signaling that the user should debug rather than proceed to the next workflow step.
