---
"@agentgrader/agent-acp": patch
---

`config.mcp_servers` (the same map agent-openrouter connects to and merges into its tool set) is now forwarded to `connection.newSession()` as `mcpServers`, converted to ACP's `McpServer` shape via the new `convertMcpServersForAcp` (stdio servers keep `command`/`args`/`env`; http/sse servers become `{ type, url, headers }`, with `env`/`headers` maps converted to ACP's `{ name, value }` list form). Previously `newSession` always passed `mcpServers: []`, so any `mcp_servers:` entries in an agent config were silently dropped for ACP runs even though the identical config worked for the AI SDK adapter. Whether the ACP agent actually connects to and uses a forwarded MCP server still depends on that agent's own ACP implementation.
