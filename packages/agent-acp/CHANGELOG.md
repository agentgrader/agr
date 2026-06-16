# @agentgrader/agent-acp

## 2.0.3

### Patch Changes

- e489a94: `config.mcp_servers` (the same map agent-openrouter connects to and merges into its tool set) is now forwarded to `connection.newSession()` as `mcpServers`, converted to ACP's `McpServer` shape via the new `convertMcpServersForAcp` (stdio servers keep `command`/`args`/`env`; http/sse servers become `{ type, url, headers }`, with `env`/`headers` maps converted to ACP's `{ name, value }` list form). Previously `newSession` always passed `mcpServers: []`, so any `mcp_servers:` entries in an agent config were silently dropped for ACP runs even though the identical config worked for the AI SDK adapter. Whether the ACP agent actually connects to and uses a forwarded MCP server still depends on that agent's own ACP implementation.
- 32b05c2: `convertMcpServersForAcp` now skips a stdio `mcp_servers:` entry that has `sandboxed: true` (logging a warning) instead of forwarding it as-is. That flag tells agent-openrouter to spawn `command` inside the Docker sandbox, so its `command`/`args` reference sandbox-only paths (e.g. `/app/...`). ACP agent subprocesses spawn `mcpServers` entries on the host, where those paths don't exist - previously this produced a confusing host-side spawn failure from the ACP agent itself; now it's a clear, attributable warning from agentgrader and the rest of the run proceeds with that server omitted.
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
- Updated dependencies [9f387b8]
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
  - @agentgrader/core@1.3.2

## 2.0.2

### Patch Changes

- cb98193: The ACP adapter now sends `config.system_prompt` (including the `toolkits`
  skills addendum that `run-single.ts` appends, listing each bundled tool's
  name and description) as a leading text block in the same prompt turn, ahead
  of the task prompt. ACP has no dedicated system-prompt field, so previously
  `system_prompt` was silently dropped for `--adapter acp` runs: an ACP agent
  running with `toolkits:` configured had the toolkit files copied into its
  sandbox, but no way to learn what those tools were for short of exploring the
  filesystem itself.

## 2.0.1

### Patch Changes

- 6c3c87b: The ACP adapter's `terminal/output` handler now also emits a `tool_result`
  step containing the command's actual stdout/stderr (truncated to 4000
  chars), not just the terminal ID. This lets `agr trace` show what ACP-run
  commands printed, and lets toolkit scripts that self-report adoption via a
  "<name>: ..." marker line (see `wasCommandUsed` in `@agentgrader/core`)
  satisfy `require_tools_before_submit` on ACP runs too.
- Updated dependencies [631b5af]
- Updated dependencies [4f141ee]
  - @agentgrader/core@1.3.1

## 2.0.0

### Minor Changes

- Add `@agentgrader/agent-acp` with `AcpAgentAdapter`: Agentgrader acts as an ACP client, spawns ACP-compatible agents (Claude Code, Cursor Agent, etc.) over stdio via `@agentclientprotocol/sdk`, and routes fs/terminal tool calls into the Docker sandbox. `@agentgrader/core` gains optional `acp_command`, `acp_args`, `acp_cwd`, and `acp_env` on `AgentConfig`. The CLI adds `--adapter` (`ai-sdk` | `acp`) for `agr run` and `--adapters` for `agr bench`.

### Patch Changes

- Updated dependencies [0324c8a]
- Updated dependencies
- Updated dependencies [8873f9a]
- Updated dependencies [9c911e7]
- Updated dependencies [490e98d]
  - @agentgrader/core@1.3.0
