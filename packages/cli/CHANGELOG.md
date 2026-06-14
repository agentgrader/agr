# agentgrader

## 1.5.1

### Patch Changes

- 76f766a: Add `agr toolkit-add <name> [--dir <toolkitDir>]`: scaffolds a new toolkit tool as a `bin/<name>` shell script stub plus a matching `.claude/skills/<name>/SKILL.md` stub, following the layout used by `toolkits/jetbrains-tools`. Both files are TODO-filled templates - implement the script and fill in the skill description, then reference `<toolkitDir>` from `toolkits:` in an agent config or test case. Previously, adding a new toolkit tool meant hand-copying an existing `bin/`+`SKILL.md` pair and editing every reference.
- ae11ad1: Fix `expandMatrix` silently dropping `base.require_tools_before_submit`: it was missing from `MatrixBaseSchema` (so zod stripped it) and from the per-combination `AgentConfig` it builds, so `metrics["tool-adoption"]` never appeared for `agr bench --matrix` runs even when configured in `base`.
- caf23c3: Add `require_tools_before_submit: string[]` to agent config: a list of command names (e.g. a toolkit's `run-tests`, or a generic `pytest`/`biome`) that should have been invoked at least once before `submit`. Checked against `executeCommand`/`terminal/create` first-words and direct tool names via the new `wasCommandUsed` helper. Never blocks the run - purely annotates `metrics["tool-adoption"]` (`{ passed, detail, required, missing }`), surfaced by `agr trace --quality` and a new `TOOL ADOPTION BY CONFIG` footer in `agr bench`. Lets users measure whether a custom toolkit's tools are configured but unused, without manually grepping trace output.
- 4f141ee: Add an optional `track_tools` agent config field for non-gating toolkit-tool
  adoption analytics. Listed command names are checked the same way as
  `require_tools_before_submit`, but the result only annotates
  `metrics["tool-usage"]` (used/unused breakdown) without affecting
  `metrics["tool-adoption"]` or pass/fail. `agr trace --quality` now prints a
  "Tool usage (track_tools)" section when this metric is present. Useful for
  watching adoption trends of optional toolkit tools (e.g. a new
  `show-call-hierarchy`) over many runs without making them required.
- e5862a3: Bucket `executeCommand` (AI SDK adapter) and `terminal/create` (ACP adapter) calls by the first word of the command in `agr trace --tools` and the `agr bench` `TOOL USAGE BY CONFIG` footer (e.g. `executeCommand:find-usages`, `terminal/create:pytest` instead of one opaque `executeCommand`/`terminal/create` bucket). Previously, a custom toolkit's CLI tools were indistinguishable from generic shell exploration (`find`, `grep`, `cat`, ...) in tool-usage breakdowns, making it impossible to measure adoption of toolkit-provided commands for either adapter.
- Updated dependencies [6c3c87b]
- Updated dependencies [631b5af]
- Updated dependencies [3b2181d]
- Updated dependencies [49beb87]
- Updated dependencies [4f141ee]
  - @agentgrader/agent-acp@2.0.1
  - @agentgrader/core@1.3.1
  - @agentgrader/optimizer@2.0.1
  - @agentgrader/sandbox-docker@4.1.0

## 1.5.0

### Minor Changes

- After every `agr bench` run, print a `TOOL USAGE BY CONFIG` summary that aggregates `tool_call` counts from the SQLite trace per agent config. Makes toolkit/MCP adoption visible across a full bench sweep without running `agr trace --tools` on each run individually.

## 1.4.0

### Minor Changes

- 402cc11: `DockerSandboxProvider` now labels every sandbox container with `agentgrader.sandbox=true` and a creation timestamp, and exposes `listSandboxes()`/`removeSandbox()`. The CLI gets a new `agr cleanup` command that lists (or, with `--yes`, removes) leftover sandbox containers - e.g. from a run whose process was killed before its `cleanup` step could call `destroy()`. Combined with `step_timeout_ms`, this gives a way to both prevent and clean up the orphaned `tail -f /dev/null` containers that previously accumulated silently across runs.
- Add `@agentgrader/agent-acp` with `AcpAgentAdapter`: Agentgrader acts as an ACP client, spawns ACP-compatible agents (Claude Code, Cursor Agent, etc.) over stdio via `@agentclientprotocol/sdk`, and routes fs/terminal tool calls into the Docker sandbox. `@agentgrader/core` gains optional `acp_command`, `acp_args`, `acp_cwd`, and `acp_env` on `AgentConfig`. The CLI adds `--adapter` (`ai-sdk` | `acp`) for `agr run` and `--adapters` for `agr bench`.
- 8873f9a: Two cost/analytics improvements driven by the `provider: anthropic` setups in the JetBrains feedback loop:

  - **Anthropic prompt caching**: `@agentgrader/agent-openrouter` now sends the system prompt + tools as a `messages`-array system message with `providerOptions.anthropic.cacheControl: { type: "ephemeral" }` when `provider: anthropic`. Anthropic caches everything up to and including that block, so repeated runs with the same `agent.yaml` (e.g. `agr bench`/matrix sweeps) only pay full price for the system-prompt+tools prefix once per 5-minute cache window. No effect on other providers, which ignore the unrecognized `providerOptions` key.
  - **Cache stats in traces**: step events now carry `cachedTokens` (tokens served from Anthropic's prompt cache), persisted as a new `traces.cached_tokens` column. `agr trace <runId>` shows `cached:N` per step and a `prompt cache: X/Y input tokens served from cache (Z%)` summary line. Cost calculation also now accounts for the discounted cache-read (0.1x) and cache-write (1.25x) input pricing instead of charging full input price for cached tokens.
  - **Model escalation hook**: new optional `agent.yaml` fields `escalate_after_steps` and `escalate_model`. If the agent hasn't called `submit` after `escalate_after_steps` steps, `@agentgrader/agent-openrouter` switches to `escalate_model` (via the AI SDK's `experimental_prepareStep`, which fires before every step/LLM call) for the rest of the run - e.g. start on `claude-haiku-4-5` and escalate to a stronger model only if the cheap model is struggling, mirroring how IDE chat agents (Cursor, JetBrains) let you pick different models per turn.

- 9c911e7: `AgentResult` now has an optional `error` field, populated by `@agentgrader/agent-openrouter` whenever the `generateText` loop itself throws or aborts (including a `step_timeout_ms` timeout, with a message pointing at that setting). `runSingle` surfaces this as `metrics.agentError`, and `agr trace` prints it as `agent error:` when present. This distinguishes "the agent never got to `submit`, the loop itself errored or was aborted" from "the agent submitted but its solution failed scoring", both of which previously looked identical (`finished: false`, no detail).
- 25edd16: `agr run` now renders a proper Ink TUI instead of plain `console.log` streaming: a live step list (color-coded by kind - tool calls in blue, tool results in green, messages in white, thinking in gray - truncated to 200 chars, full detail with `--verbose`, a compact step/cost counter without it), a final summary panel (PASS/FAIL, steps, cost, duration, prompt-cache hit rate, error and regression/diff/localization metric lines), and - new - a colorized unified diff of `finalDiff` (green `+`/red `-`/cyan `@@` hunks, capped at 60 lines). Exit codes are unchanged (`0` on a completed run regardless of pass/fail, `1` if `runSingle` throws).

  Also removes every emoji/pictographic glyph from CLI output across `agr run`, `agr bench`, `agr validate`, `agr compare`, and the top-level CLI error handler, replacing them with plain bracketed labels (`[OK]`/`[WARN]`/`[FAIL]`, `PASS`/`FAIL`, `[error]`) and Ink/ANSI color - "no emoji anywhere" is now a CLI-wide convention.

- f4b1345: New `agr init [dir] [--force]` command scaffolds a minimal, runnable project: a `agent.yaml` agent config (`claude-haiku-4-5-20251001`, `provider: anthropic`) plus a tiny self-contained `tasks/hello-world` test case (implement `add(a, b)` in `math.js` so `node --test math.test.js` passes - no `npm install`/`pip install` required inside the sandbox). Refuses to overwrite an existing `agent.yaml` unless `--force` is passed, and prints next-step instructions (`agr run tasks/hello-world/agr.yaml --config agent.yaml --verbose`) so a new user can try `agr run` immediately.
- c6ee966: Add `agr trace <runId> --tools` flag, printing a tool-usage breakdown (call counts per tool name across the run's `tool_call` steps). Useful for checking whether custom toolkit/MCP tools were actually used by the agent versus only made available.
- 52f0c5c: `agr run`, `agr bench`, and `agr validate` now warn on stderr when `agent.yaml` or `agr.yaml` contains a top-level key that the installed `@agentgrader/core` doesn't recognize, e.g. `[WARN] agent config "agent.yaml": unrecognized field(s) "step_timeout_ms" - these are silently ignored. ...`.

  This catches a "config version-skew" trap found in the JetBrains feedback loop: zod's `.parse()` silently drops unrecognized keys, so a field your YAML sets (`step_timeout_ms`, `escalate_after_steps`/`escalate_model`, etc.) can have zero effect with no error if `@agentgrader/core` predates that field. The warning makes this immediately visible instead of looking like the field "just doesn't help".

### Patch Changes

- Updated dependencies [b90b9b7]
- Updated dependencies [0324c8a]
- Updated dependencies [402cc11]
- Updated dependencies
- Updated dependencies [8873f9a]
- Updated dependencies [9c911e7]
- Updated dependencies [3d853b6]
- Updated dependencies [eaa310f]
- Updated dependencies [3f69bd2]
- Updated dependencies [490e98d]
  - @agentgrader/agent-openrouter@4.0.0
  - @agentgrader/core@1.3.0
  - @agentgrader/sandbox-docker@4.0.0
  - @agentgrader/agent-acp@2.0.0
  - @agentgrader/store@1.1.0
  - @agentgrader/optimizer@2.0.0
  - @agentgrader/scorer-static@2.0.0

## 1.3.0

### Minor Changes

- Use `agent_config` from `agr.yaml` as default for `agr run`; bench fallback when all test cases share the same path.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @agentgrader/core@1.2.0
  - @agentgrader/agent-openrouter@3.0.0
  - @agentgrader/optimizer@1.0.0
  - @agentgrader/sandbox-docker@3.0.0
  - @agentgrader/scorer-static@1.0.0

## 1.2.0

### Minor Changes

- Add `agr compare <runIdA> <runIdB>` to compare step traces of two runs side by side, with `--full` and `--only-diff` options.

## 1.1.0

### Minor Changes

- Add `--configs-dir` and `--manifest` to `agr bench` for loading multiple agent config files from a directory or a bench manifest YAML with glob support.

## 1.0.7

### Patch Changes

- Truncate long config names in bench dashboard; improve import-pr test-runner detection and clone-fixture messaging; add validate --strict tip when execution checks are skipped.
- Updated dependencies
- Updated dependencies
  - @agentgrader/agent-openrouter@2.0.3
  - @agentgrader/optimizer@0.1.1

## 1.0.6

### Patch Changes

- Bump @agentgrader/store dependency to ^1.0.3 for getRunsByMatrixId export.
- Add --verbose to agr run; CLI help examples; --config alias for bench; improve import-pr scaffolding and validate UX (--strict, skip warnings); clearer run summary for skipped scorers.
- Updated dependencies
- Updated dependencies
  - @agentgrader/core@1.1.3
  - @agentgrader/store@1.0.3

## 1.0.5

### Patch Changes

- `agr run`/`agr validate`/`agr bench` now print a readable, one-issue-per-line summary when an `agr.yaml` test case or agent config YAML fails schema validation, instead of dumping the raw Zod error as JSON.
- Updated dependencies
  - @agentgrader/sandbox-docker@2.0.2

## 1.0.4

### Patch Changes

- 99b8f7d: The `agr` CLI now loads `.env` from the current working directory via `dotenv/config`, so `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`OPENROUTER_API_KEY` set in a project's `.env` file are picked up. Additionally, `AiSdkAgentAdapter` now throws a clear error naming the missing environment variable instead of silently falling back to a `"mock-key"` and failing with a cryptic "Missing Authentication header" from the provider.
- Updated dependencies [99b8f7d]
  - @agentgrader/agent-openrouter@2.0.1

## 1.0.3

### Patch Changes

- 8c85583: Running a command with missing required arguments (e.g. `agr run` with no test case path) now prints a friendly error and the command's help instead of crashing with a raw `CACError` stack trace.
- Updated dependencies [8c85583]
  - @agentgrader/core@1.1.1

## 1.0.2

### Patch Changes

- 81eff8a: fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies [94a1869]
- Updated dependencies [81eff8a]
- Updated dependencies [ef07b0a]
  - @agentgrader/agent-openrouter@2.0.0
  - @agentgrader/core@1.1.0
  - @agentgrader/store@1.0.2
  - @agentgrader/sandbox-docker@2.0.0

## 1.0.1

### Patch Changes

- Fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies
  - @agentgrader/core@1.0.1
  - @agentgrader/store@1.0.1
  - @agentgrader/sandbox-docker@1.0.1
  - @agentgrader/agent-openrouter@1.0.1

## 1.0.0

### Major Changes

- initial release of the agentgrader cli and core framework.

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.0.0
  - @agentgrader/store@1.0.0
  - @agentgrader/sandbox-docker@1.0.0
  - @agentgrader/agent-openrouter@1.0.0
