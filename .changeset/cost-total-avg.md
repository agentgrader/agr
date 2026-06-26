---
"agentgrader": patch
---

`agr cost --total` prints the total cost as a plain decimal number (e.g. `1.2345`) for shell script use: `COST=$(agr cost --total --since 7d)`; `agr cost --avg` prints the average cost per run; both skip the `$` prefix for easy arithmetic; combinable with all existing filter flags (`--since`, `--test-case`, `--config`, `--model`, etc.)
