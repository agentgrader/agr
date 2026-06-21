---
"agentgrader": patch
---

`agr status --by-test-case --show-ids` appends `last run: agr trace <id>` to each breakdown row, showing the most recent run ID as a direct trace shortcut; works with `--by-config` and `--by-model` too; `lastRunId` is also included in `--json` output; useful for quickly tracing the last run of a failing test case without needing to look up the ID separately
