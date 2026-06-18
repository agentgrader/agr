---
"agentgrader": patch
---

`agr run --provider <name>` and `agr bench --provider <name>` override the provider for all agent configs without editing YAML; useful for quick cross-provider comparisons (e.g. `--provider openrouter`); also fixes `agr bench --report-dir` not being passed through to the bench command
