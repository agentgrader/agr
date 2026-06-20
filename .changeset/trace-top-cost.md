---
"agentgrader": patch
---

`agr trace --last --top-cost 5` shows only the 5 most expensive steps sorted by cost descending; the header shows `top N most expensive step(s) of M total (sorted by cost desc)`; combinable with `--full`, `--grep`, `--steps`, and all run-selection flags; useful for finding where a run's token budget was spent
