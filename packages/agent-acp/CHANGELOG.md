# @agentgrader/agent-acp

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
