---
"@agentgrader/core": patch
"@agentgrader/sandbox-docker": minor
"@agentgrader/agent-openrouter": minor
---

Add sandbox-bridged MCP spawning: a stdio `mcp_servers:` entry can now set `sandboxed: true` to run inside the agr Docker sandbox (via `docker exec -i`) instead of on the host.

- `@agentgrader/core`: `McpServerConfigSchema`'s stdio variant gains an optional `sandboxed: boolean`, and `SandboxHandle` gains an optional `spawnStdio(cmd)` method returning a `SandboxStdioProcess` (stdin/stdout/stderr/exit bridge).
- `@agentgrader/sandbox-docker`: `DockerSandboxHandle.spawnStdio()` implements this via `docker exec -i <container> sh -c <cmd>` as a host child process (dockerode's `exec.start({hijack: true})` hangs forever under Bun, so this shells out to the `docker` CLI instead).
- `@agentgrader/agent-openrouter`: when a stdio `mcp_servers` entry has `sandboxed: true`, a new `SandboxStdioMcpTransport` runs the server via `sandbox.spawnStdio` and frames messages as newline-delimited JSON, so the server's `command` sees the task's sandboxed `/app` fixture files instead of the host filesystem.

This closes the gap noted in `docs/advanced/acp-agent.md`'s "Sandbox caveat": previously, all stdio `mcp_servers` entries were spawned on the host regardless of adapter.
