---
"agentgrader": patch
---

`agr trace --last --summary` prints a compact one-line run overview (pass/fail, test case, config, steps, cost, duration) without the full step trace; `--json` emits the run object only; useful in scripts and watch loops where you want a quick health check after a run completes
