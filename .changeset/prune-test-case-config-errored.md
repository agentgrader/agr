---
"agentgrader": patch
---

`agr prune` now supports three additional filter modes: `--test-case <name>` deletes all runs for a specific test case (substring match, useful for resetting a test case and starting fresh), `--config <name>` deletes runs for a specific agent config, and `--errored` deletes all errored runs (status=failed with no pass/fail score, useful for clearing crashed sandbox artifacts); all filters are combinable with `--before` and each other; `--before` is no longer required when another filter is specified
