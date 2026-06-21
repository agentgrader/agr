---
"agentgrader": patch
---

`agr trace --last --min-cost 0.001` shows only steps costing at least $0.001; `--max-cost 0.0001` shows only cheap/free steps; both filter before `--top-cost`; header shows `N step(s) costing >= $X of M total`; combinable with all other trace filter and view flags
