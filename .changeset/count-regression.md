---
"agentgrader": patch
---

`agr count --regression` counts test cases that have regressed: at least one historical passing run but the most recent N consecutive runs all failed (N = 3 by default, override with `--regression-window N`); prints a plain integer; `--json` emits `{regressions, regressionWindow, dbPath}`; useful in CI gate scripts (`if [ $(agr count --regression) -gt 0 ]; then echo "REGRESSIONS DETECTED"; fi`)
