---
"@agentgrader/agent-acp": patch
---

The ACP adapter's `terminal/output` handler now also emits a `tool_result`
step containing the command's actual stdout/stderr (truncated to 4000
chars), not just the terminal ID. This lets `agr trace` show what ACP-run
commands printed, and lets toolkit scripts that self-report adoption via a
"<name>: ..." marker line (see `wasCommandUsed` in `@agentgrader/core`)
satisfy `require_tools_before_submit` on ACP runs too.
