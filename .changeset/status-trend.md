---
"agentgrader": patch
---

`agr status --since <window> --trend` compares the current window to the equal-length window before it, showing solve-rate delta (pp), run count delta, and avg cost delta with directional arrows; useful for catching regressions after bench runs; combinable with `--test-case`, `--config`, `--sandbox`; `--json` emits `{current, previous, delta}` for scripting
