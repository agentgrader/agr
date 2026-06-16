---
"agentgrader": patch
---

`agr trace --last --config <name>` and `agr compare --last-two --config <name>` scope to the most recent run(s) for a specific agent config (substring match on `agentConfigId`); completes the `--test-case`/`--config` filter symmetry across all per-run debug commands; combinable with `--test-case` for narrow scoping
