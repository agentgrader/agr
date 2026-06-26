---
"agentgrader": patch
---

`agr trace --last --find-tool bash` filters the trace to only show steps where the tool name contains "bash" (case-insensitive substring match); combinable with `--json` for structured output; useful for debugging agent tool usage patterns; equivalent to `--kind tool_call --grep bash` but more ergonomic for tool-name filtering
