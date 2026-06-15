---
"@agentgrader/agent-acp": patch
---

`convertMcpServersForAcp` now skips a stdio `mcp_servers:` entry that has `sandboxed: true` (logging a warning) instead of forwarding it as-is. That flag tells agent-openrouter to spawn `command` inside the Docker sandbox, so its `command`/`args` reference sandbox-only paths (e.g. `/app/...`). ACP agent subprocesses spawn `mcpServers` entries on the host, where those paths don't exist - previously this produced a confusing host-side spawn failure from the ACP agent itself; now it's a clear, attributable warning from agentgrader and the rest of the run proceeds with that server omitted.
