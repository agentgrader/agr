---
"agentgrader": patch
---

`agr list --errored` filters the run list to only runs that errored (sandbox crash, tool failure, or network error — any run with a non-empty error field); shorthand complementing `agr prune --errored`; combinable with `--since`, `--test-case`, `--config`, `--plain`, and `--json`
