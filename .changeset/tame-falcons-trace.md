---
"agentgrader": minor
---

Add `agr trace <runId> --tools` flag, printing a tool-usage breakdown (call counts per tool name across the run's `tool_call` steps). Useful for checking whether custom toolkit/MCP tools were actually used by the agent versus only made available.
