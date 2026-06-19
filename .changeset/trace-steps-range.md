---
"agentgrader": patch
---

`agr trace --steps <range>` shows only the specified stepIndex range (e.g. `--steps 40-60` or `--steps 42`); the header shows `N step(s) [40-60] of 127 total` so context is not lost; combinable with `--last`, `--json`, and all run-selection flags; useful for navigating long traces without scrolling through hundreds of steps
