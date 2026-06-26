---
"agentgrader": patch
---

`agr export summary --output summary.json` exports a comprehensive summary JSON file containing overall stats (total runs, pass/fail counts, solve rate, cost), per-test-case breakdown sorted by solve rate, and per-config breakdown; `--since <window>` scopes to recent runs; useful for dashboards, CI artifacts, and automated reporting
