# @agentgrader/core

## 1.4.0

### Minor Changes

- patch descriptions

## 1.3.2

### Patch Changes

- e489a94: `metrics["tool-adoption"]`/`metrics["tool-usage"]` now record `usedVia: "direct" | "wrapped"` per tool, via the new `getCommandUsageSource` (refactored from `wasCommandUsed`). `agr trace --quality` prints `OK (called directly)` vs. `OK (via another tool's output)` vs. `MISSING` per required/tracked tool, falling back to `OK (mechanism not recorded for this run)` for runs predating this change. Previously both cases were reported identically as `OK`, making it impossible to tell whether a required tool was actually invoked or only credited because a composite tool wrapped it.
- e489a94: `wasCommandUsed` (and `getCommandUsageSource`) now also match `tool_<name>` entries, the first-class AI-SDK tools agent-openrouter registers for each toolkit skill (e.g. `tool_rename_symbol` for `rename-symbol`). Previously only the prompt-described `executeCommand`/`terminal/create` paths were matched, so a toolkit tool invoked via `tool_<name>` was invisible to `metrics["tool-usage"]`/`metrics["tool-adoption"]`, undercounting real adoption.
- 9f387b8: Add sandbox-bridged MCP spawning: a stdio `mcp_servers:` entry can now set `sandboxed: true` to run inside the agr Docker sandbox (via `docker exec -i`) instead of on the host.

  - `@agentgrader/core`: `McpServerConfigSchema`'s stdio variant gains an optional `sandboxed: boolean`, and `SandboxHandle` gains an optional `spawnStdio(cmd)` method returning a `SandboxStdioProcess` (stdin/stdout/stderr/exit bridge).
  - `@agentgrader/sandbox-docker`: `DockerSandboxHandle.spawnStdio()` implements this via `docker exec -i <container> sh -c <cmd>` as a host child process (dockerode's `exec.start({hijack: true})` hangs forever under Bun, so this shells out to the `docker` CLI instead).
  - `@agentgrader/agent-openrouter`: when a stdio `mcp_servers` entry has `sandboxed: true`, a new `SandboxStdioMcpTransport` runs the server via `sandbox.spawnStdio` and frames messages as newline-delimited JSON, so the server's `command` sees the task's sandboxed `/app` fixture files instead of the host filesystem.

  This closes the gap noted in `docs/advanced/acp-agent.md`'s "Sandbox caveat": previously, all stdio `mcp_servers` entries were spawned on the host regardless of adapter.

- e489a94: agent-openrouter now registers each toolkit skill (`.claude/skills/<name>/SKILL.md`, backed by `bin/<name>`) as its own first-class tool named `tool_<name>` (hyphens become underscores), with the skill's description and an `args` passthrough param, executing `<name> <args>` in the sandbox. Per `JETBRAINS_FEEDBACK.md` iteration 76 (7th confirming variant), `claude-haiku-4-5-20251001` reliably calls tools that appear in its real tool list (`readFile`/`writeFile`/`executeCommand`/`submit`) but does not invoke toolkit commands that are only _described_ in the system prompt and run via `executeCommand <name> <args>` - registering them as first-class tools gives these commands the same adoption odds as built-in tools. `run-single.ts` now always propagates the merged toolkit list via `effectiveConfig.toolkits`, so adapters can call `discoverSkillsForToolkits` independently of whether the system-prompt addendum was built.
- e489a94: `bucketToolName` (used by `metrics["tool-usage"]`/`metrics["tool-adoption"]`) now strips one or more leading `cd <dir> &&`/`cd <dir>;` prefixes before taking the command's first word. Previously, `executeCommand`/`terminal/create` calls that `cd` into the project before running the real command (e.g. `cd /app && python -m pytest ...`) bucketed as `executeCommand:cd`, hiding the actual command (`python`) from tool-usage/tool-adoption tracking. A bare `cd <dir>` with nothing after it still buckets as `cd`.

## 1.3.1

### Patch Changes

- 631b5af: `require_tools_before_submit` adoption checks now also count a tool as
  "used" if a tool_result's output contains a `<name>: ` marker line, even
  when the agent never invoked `<name>` directly. This lets a composite
  toolkit tool (e.g. a `rename-symbol` that runs `run-tests` internally after
  renaming) satisfy adoption for the tool it wraps, as long as the wrapped
  tool prints a self-identifying output line.
- 4f141ee: Add an optional `track_tools` agent config field for non-gating toolkit-tool
  adoption analytics. Listed command names are checked the same way as
  `require_tools_before_submit`, but the result only annotates
  `metrics["tool-usage"]` (used/unused breakdown) without affecting
  `metrics["tool-adoption"]` or pass/fail. `agr trace --quality` now prints a
  "Tool usage (track_tools)" section when this metric is present. Useful for
  watching adoption trends of optional toolkit tools (e.g. a new
  `show-call-hierarchy`) over many runs without making them required.

## 1.3.0

### Minor Changes

- 0324c8a: Fix the "run stalls with no `RUN SUMMARY` and a leftover container" failure mode at its actual source: `DockerSandboxHandle.exec()` had no timeout at all. Any command that hangs inside the sandbox - an agent-induced infinite loop, a test that never returns, a network install that never connects - blocked `exec()` forever, and with it the entire run (scoring and cleanup included), with zero log output.

  - `exec(cmd, timeoutMs = 180000)`: stops waiting after `timeoutMs` and returns `{ exitCode: 124, timedOut: true }` instead of hanging forever. The process may still be running inside the container; `destroy()` reaps it.
  - `CommandScorer` reports `timedOut` commands with a clear "timed out and was abandoned" message instead of looking like a generic failure.
  - `runSingle`'s `score` step now short-circuits when the agent loop itself errored (e.g. a `step_timeout_ms` abort) - it no longer runs the full test suite against a guaranteed-fail run, which previously risked compounding one hang (the agent loop) with another (an unbounded `sandbox.exec` during scoring).
  - `runSingle`'s `cleanup` step now bounds `sandbox.destroy()` to 60s, so a wedged Docker daemon can no longer block the final `RUN SUMMARY`.

  This was the real cause behind the "stops mid-trace with no RUN SUMMARY" symptom previously attributed only to `generateText` provider hangs (see `step_timeout_ms`): that watchdog correctly aborted the agent loop, but the unguarded scoring-phase `sandbox.exec` of `test_command` against a half-edited fixture could then hang the rest of the run indefinitely with no further output.

- Add `@agentgrader/agent-acp` with `AcpAgentAdapter`: Agentgrader acts as an ACP client, spawns ACP-compatible agents (Claude Code, Cursor Agent, etc.) over stdio via `@agentclientprotocol/sdk`, and routes fs/terminal tool calls into the Docker sandbox. `@agentgrader/core` gains optional `acp_command`, `acp_args`, `acp_cwd`, and `acp_env` on `AgentConfig`. The CLI adds `--adapter` (`ai-sdk` | `acp`) for `agr run` and `--adapters` for `agr bench`.
- 8873f9a: Two cost/analytics improvements driven by the `provider: anthropic` setups in the JetBrains feedback loop:

  - **Anthropic prompt caching**: `@agentgrader/agent-openrouter` now sends the system prompt + tools as a `messages`-array system message with `providerOptions.anthropic.cacheControl: { type: "ephemeral" }` when `provider: anthropic`. Anthropic caches everything up to and including that block, so repeated runs with the same `agent.yaml` (e.g. `agr bench`/matrix sweeps) only pay full price for the system-prompt+tools prefix once per 5-minute cache window. No effect on other providers, which ignore the unrecognized `providerOptions` key.
  - **Cache stats in traces**: step events now carry `cachedTokens` (tokens served from Anthropic's prompt cache), persisted as a new `traces.cached_tokens` column. `agr trace <runId>` shows `cached:N` per step and a `prompt cache: X/Y input tokens served from cache (Z%)` summary line. Cost calculation also now accounts for the discounted cache-read (0.1x) and cache-write (1.25x) input pricing instead of charging full input price for cached tokens.
  - **Model escalation hook**: new optional `agent.yaml` fields `escalate_after_steps` and `escalate_model`. If the agent hasn't called `submit` after `escalate_after_steps` steps, `@agentgrader/agent-openrouter` switches to `escalate_model` (via the AI SDK's `experimental_prepareStep`, which fires before every step/LLM call) for the rest of the run - e.g. start on `claude-haiku-4-5` and escalate to a stronger model only if the cheap model is struggling, mirroring how IDE chat agents (Cursor, JetBrains) let you pick different models per turn.

- 9c911e7: `AgentResult` now has an optional `error` field, populated by `@agentgrader/agent-openrouter` whenever the `generateText` loop itself throws or aborts (including a `step_timeout_ms` timeout, with a message pointing at that setting). `runSingle` surfaces this as `metrics.agentError`, and `agr trace` prints it as `agent error:` when present. This distinguishes "the agent never got to `submit`, the loop itself errored or was aborted" from "the agent submitted but its solution failed scoring", both of which previously looked identical (`finished: false`, no detail).
- 490e98d: Add `step_timeout_ms` to `agent_config` (default 120000ms), wired into `generateText`'s `abortSignal` in `@agentgrader/agent-openrouter`. Previously a single stalled provider request (no response, no error) left the entire run - and its sandbox container - hanging forever with no result and no cleanup, since the hang happens inside an awaited call that never settles and the surrounding try/catch never fires. With a timeout, the call aborts, the error is logged, and the workflow proceeds to scoring and `cleanup` (which destroys the sandbox). Also added as a matrix dimension/base field in `@agentgrader/optimizer`.

### Patch Changes

- Updated dependencies [8873f9a]
  - @agentgrader/store@1.1.0

## 1.2.0

### Minor Changes

- Add optional `agent_config` field to test case schema for default agent YAML path in `agr.yaml`.

## 1.1.3

### Patch Changes

- Add onStep callback to runSingle for live CLI streaming; rename skipped execution-checks validation entry for clearer reporting.
- Updated dependencies
  - @agentgrader/store@1.0.3

## 1.1.2

### Patch Changes

- `AgentConfigSchema` now accepts an optional `provider` field. Previously this field was silently stripped by Zod during validation, so setting `provider: anthropic` (or `openai`) in an agent config YAML had no effect and the adapter always fell back to the `openrouter` default.

## 1.1.1

### Patch Changes

- 8c85583: Fixed `runSingle` and `runBenchmark` reading workflow results from a non-existent `res.results` field (the installed `@mastra/core` version exposes per-step output under `res.steps.<id>.output`, not `res.results`). Previously every run silently reported `passed: false, score: 0` regardless of the actual outcome, and `runBenchmark` always returned an empty `runs` array.

## 1.1.0

### Minor Changes

- ef07b0a: add support for passing an array of `adapters: agentadapter[]` to `runbenchmark`, enabling cross-matrix benchmarking of different adapter architectures alongside test cases and agent configs.

### Patch Changes

- 81eff8a: fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies [81eff8a]
  - @agentgrader/store@1.0.2

## 1.0.1

### Patch Changes

- Fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies
  - @agentgrader/store@1.0.1

## 1.0.0

### Major Changes

- initial release of the agentgrader cli and core framework.

### Patch Changes

- Updated dependencies
  - @agentgrader/store@1.0.0
