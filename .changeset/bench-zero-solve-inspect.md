---
"agentgrader": patch
---

`agr bench` now shows `Inspect:` instead of `Next:` when solve rate is 0% (all cases failed), even without `--fail-on-failure` or `--min-solve-rate`, since a 0% result always means the user needs to debug rather than proceed.
