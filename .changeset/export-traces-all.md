---
"agentgrader": patch
---

`agr export traces --all --format jsonl --output all-traces.jsonl` exports traces for all runs in the database without requiring any filter; combine with `--limit N` to cap total runs exported; previously required at least `--test-case`, `--config`, `--since`, or `--run-id`
