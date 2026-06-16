# @agentgrader/agent-openrouter

## 5.0.0

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.4.0

## 4.1.0

### Minor Changes

- 9f387b8: Add sandbox-bridged MCP spawning: a stdio `mcp_servers:` entry can now set `sandboxed: true` to run inside the agr Docker sandbox (via `docker exec -i`) instead of on the host.

  - `@agentgrader/core`: `McpServerConfigSchema`'s stdio variant gains an optional `sandboxed: boolean`, and `SandboxHandle` gains an optional `spawnStdio(cmd)` method returning a `SandboxStdioProcess` (stdin/stdout/stderr/exit bridge).
  - `@agentgrader/sandbox-docker`: `DockerSandboxHandle.spawnStdio()` implements this via `docker exec -i <container> sh -c <cmd>` as a host child process (dockerode's `exec.start({hijack: true})` hangs forever under Bun, so this shells out to the `docker` CLI instead).
  - `@agentgrader/agent-openrouter`: when a stdio `mcp_servers` entry has `sandboxed: true`, a new `SandboxStdioMcpTransport` runs the server via `sandbox.spawnStdio` and frames messages as newline-delimited JSON, so the server's `command` sees the task's sandboxed `/app` fixture files instead of the host filesystem.

  This closes the gap noted in `docs/advanced/acp-agent.md`'s "Sandbox caveat": previously, all stdio `mcp_servers` entries were spawned on the host regardless of adapter.

- e489a94: agent-openrouter now registers each toolkit skill (`.claude/skills/<name>/SKILL.md`, backed by `bin/<name>`) as its own first-class tool named `tool_<name>` (hyphens become underscores), with the skill's description and an `args` passthrough param, executing `<name> <args>` in the sandbox. Per `JETBRAINS_FEEDBACK.md` iteration 76 (7th confirming variant), `claude-haiku-4-5-20251001` reliably calls tools that appear in its real tool list (`readFile`/`writeFile`/`executeCommand`/`submit`) but does not invoke toolkit commands that are only _described_ in the system prompt and run via `executeCommand <name> <args>` - registering them as first-class tools gives these commands the same adoption odds as built-in tools. `run-single.ts` now always propagates the merged toolkit list via `effectiveConfig.toolkits`, so adapters can call `discoverSkillsForToolkits` independently of whether the system-prompt addendum was built.

### Patch Changes

- 30ee67c: Fix `resolveProvider` to no longer treat `OPENAI_API_KEY` as a signal that OpenRouter is configured. Previously, setting only `OPENAI_API_KEY` (no `OPENROUTER_API_KEY`) for a `gpt-`/`o`-series model resolved to provider `"openrouter"`, which then called OpenRouter's API using the OpenAI key and failed. Now only `OPENROUTER_API_KEY` short-circuits the native-provider checks, so a `gpt-`/`o`-series model with only `OPENAI_API_KEY` correctly resolves to provider `"openai"`.
- e489a94: Fix prompt-cache token accounting in `onStepFinish`: Anthropic's `usage.promptTokens` (`input_tokens`) already excludes `cache_read`/`cache_creation` tokens, but `onStepFinish` subtracted them again, clamping the fresh-token cost term to ~0 and undercounting step cost. It also emitted `tokensIn` as the fresh-only count while `cachedTokens` came from a separate, often-larger pool, producing >100% "prompt cache hit rate" in `agr trace` and the run summary. `tokensIn` is now `promptTokens + cacheRead + cacheCreation` (total input tokens), so `cachedTokens <= tokensIn` always holds. Also adds a `claude-haiku-4-5`/`claude-sonnet-4` pricing case to `getPricing()`, which previously fell through to the unknown-model default ($2/$10 per 1M vs. actual $1/$5 for Haiku 4.5).
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
- Updated dependencies [9f387b8]
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
  - @agentgrader/core@1.3.2

## 4.0.0

### Minor Changes

- b90b9b7: `step_timeout_ms` is now a true per-step inactivity watchdog instead of `AbortSignal.timeout`. The previous implementation had two serious flaws discovered in real runs: the signal capped the ENTIRE multi-step loop at `step_timeout_ms` (long, healthy runs could be cut off mid-flight), and `AbortSignal.timeout`'s unref'd timer neither kept the event loop alive nor reliably fired when a provider connection silently died - leaving the run either hanging forever or, worse, exiting 0 with no error, no result, and a leaked sandbox container. The new implementation arms a ref'd timer that is reset on every finished step and aborts only when a single step makes no progress for `step_timeout_ms`; the ref'd timer also pins the event loop, so a stranded provider request can no longer silently drain the process.

  A second real-run finding: even after the watchdog calls `AbortController.abort()`, a provider connection that already died silently can strand the AI SDK's `generateText` promise so it never rejects, leaving the run hung past the abort. There is now a hard escape hatch: 15 seconds after the abort fires, if `generateText` still has not settled, the run is forced to end with the abort's reason via `Promise.race`, and proceeds to scoring and cleanup as normal. Both the watchdog firing and the escape hatch triggering are logged to stderr with a `[watchdog]` prefix.

- 8873f9a: Two cost/analytics improvements driven by the `provider: anthropic` setups in the JetBrains feedback loop:

  - **Anthropic prompt caching**: `@agentgrader/agent-openrouter` now sends the system prompt + tools as a `messages`-array system message with `providerOptions.anthropic.cacheControl: { type: "ephemeral" }` when `provider: anthropic`. Anthropic caches everything up to and including that block, so repeated runs with the same `agent.yaml` (e.g. `agr bench`/matrix sweeps) only pay full price for the system-prompt+tools prefix once per 5-minute cache window. No effect on other providers, which ignore the unrecognized `providerOptions` key.
  - **Cache stats in traces**: step events now carry `cachedTokens` (tokens served from Anthropic's prompt cache), persisted as a new `traces.cached_tokens` column. `agr trace <runId>` shows `cached:N` per step and a `prompt cache: X/Y input tokens served from cache (Z%)` summary line. Cost calculation also now accounts for the discounted cache-read (0.1x) and cache-write (1.25x) input pricing instead of charging full input price for cached tokens.
  - **Model escalation hook**: new optional `agent.yaml` fields `escalate_after_steps` and `escalate_model`. If the agent hasn't called `submit` after `escalate_after_steps` steps, `@agentgrader/agent-openrouter` switches to `escalate_model` (via the AI SDK's `experimental_prepareStep`, which fires before every step/LLM call) for the rest of the run - e.g. start on `claude-haiku-4-5` and escalate to a stronger model only if the cheap model is struggling, mirroring how IDE chat agents (Cursor, JetBrains) let you pick different models per turn.

- 9c911e7: `AgentResult` now has an optional `error` field, populated by `@agentgrader/agent-openrouter` whenever the `generateText` loop itself throws or aborts (including a `step_timeout_ms` timeout, with a message pointing at that setting). `runSingle` surfaces this as `metrics.agentError`, and `agr trace` prints it as `agent error:` when present. This distinguishes "the agent never got to `submit`, the loop itself errored or was aborted" from "the agent submitted but its solution failed scoring", both of which previously looked identical (`finished: false`, no detail).
- 3f69bd2: Add `experimental_repairToolCall` to the AI SDK agent loop: if the model calls a tool name that isn't registered (e.g. a toolkit/skill CLI command like `find-usages` that's only runnable via `executeCommand`, not a first-class tool), the call is replayed as `executeCommand "<toolName> <args...>"` instead of aborting the entire run with `NoSuchToolError`. Previously a single hallucinated tool name (common with smaller models like Haiku) would terminate the run after only a few steps with a generic error.
- 490e98d: Add `step_timeout_ms` to `agent_config` (default 120000ms), wired into `generateText`'s `abortSignal` in `@agentgrader/agent-openrouter`. Previously a single stalled provider request (no response, no error) left the entire run - and its sandbox container - hanging forever with no result and no cleanup, since the hang happens inside an awaited call that never settles and the surrounding try/catch never fires. With a timeout, the call aborts, the error is logged, and the workflow proceeds to scoring and `cleanup` (which destroys the sandbox). Also added as a matrix dimension/base field in `@agentgrader/optimizer`.

### Patch Changes

- eaa310f: Fix a crash in the `step_timeout_ms` watchdog's own error-handling: when the escape-hatch timer forced the agent loop to end, the `catch` block read `err.name`/`err.message` on a rejection value that can be `undefined` (Bun's `AbortController.abort(reason)` does not reliably populate `signal.reason`), throwing `TypeError: undefined is not an object (evaluating 'err.name')` instead of the intended `Aborted: a single step exceeded step_timeout_ms (...)` message.

  The watchdog itself fired correctly and the run still finished with a `RUN SUMMARY` - only the reported `error` text was wrong/confusing (`agr trace`'s "agent error:" line showed the `TypeError` instead of the actual timeout reason). Now checks `watchdogController.signal.aborted` directly rather than relying on the caught value's shape.

- Updated dependencies [0324c8a]
- Updated dependencies
- Updated dependencies [8873f9a]
- Updated dependencies [9c911e7]
- Updated dependencies [490e98d]
  - @agentgrader/core@1.3.0

## 3.0.0

### Minor Changes

- Filter available tools by optional `tools:` allowlist in agent config; always include `submit`.

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.2.0

## 2.0.3

### Patch Changes

- Infer anthropic/openai provider from model name when OpenRouter keys are missing but the matching API key is set.

## 2.0.2

### Patch Changes

- Fix `@ai-sdk/anthropic` dependency range (`^3.0.82`, an AI SDK 5 package) being incompatible with the installed `ai@^4.x` (AI SDK 4), which caused `provider: anthropic` to fail with "Unsupported model version. AI SDK 4 only supports models that implement specification version 'v1'." Pinned to `^1.2.12`, the AI SDK 4-compatible major version, matching `@ai-sdk/openai@^1.1.0`.
- Updated dependencies
  - @agentgrader/core@1.1.2

## 2.0.1

### Patch Changes

- 99b8f7d: The `agr` CLI now loads `.env` from the current working directory via `dotenv/config`, so `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`OPENROUTER_API_KEY` set in a project's `.env` file are picked up. Additionally, `AiSdkAgentAdapter` now throws a clear error naming the missing environment variable instead of silently falling back to a `"mock-key"` and failing with a cryptic "Missing Authentication header" from the provider.

## 2.0.0

### Minor Changes

- 94a1869: Refactored the default CLI adapter to seamlessly support Anthropic and OpenAI natively. The adapter now reads `config.provider` (e.g. `"anthropic"`, `"openai"`, `"openrouter"`) from your configuration and dynamically instantiates the appropriate AI SDK client, falling back to OpenRouter by default. The internal class has been renamed to `AiSdkAgentAdapter`, but `OpenRouterAgentAdapter` remains available as an alias for backwards compatibility.

### Patch Changes

- 81eff8a: fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies [81eff8a]
- Updated dependencies [ef07b0a]
  - @agentgrader/core@1.1.0

## 1.0.1

### Patch Changes

- Fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies
  - @agentgrader/core@1.0.1

## 1.0.0

### Major Changes

- initial release of the agentgrader cli and core framework.

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.0.0
