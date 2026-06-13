# @agentgrader/store

## 1.1.0

### Minor Changes

- 8873f9a: Two cost/analytics improvements driven by the `provider: anthropic` setups in the JetBrains feedback loop:

  - **Anthropic prompt caching**: `@agentgrader/agent-openrouter` now sends the system prompt + tools as a `messages`-array system message with `providerOptions.anthropic.cacheControl: { type: "ephemeral" }` when `provider: anthropic`. Anthropic caches everything up to and including that block, so repeated runs with the same `agent.yaml` (e.g. `agr bench`/matrix sweeps) only pay full price for the system-prompt+tools prefix once per 5-minute cache window. No effect on other providers, which ignore the unrecognized `providerOptions` key.
  - **Cache stats in traces**: step events now carry `cachedTokens` (tokens served from Anthropic's prompt cache), persisted as a new `traces.cached_tokens` column. `agr trace <runId>` shows `cached:N` per step and a `prompt cache: X/Y input tokens served from cache (Z%)` summary line. Cost calculation also now accounts for the discounted cache-read (0.1x) and cache-write (1.25x) input pricing instead of charging full input price for cached tokens.
  - **Model escalation hook**: new optional `agent.yaml` fields `escalate_after_steps` and `escalate_model`. If the agent hasn't called `submit` after `escalate_after_steps` steps, `@agentgrader/agent-openrouter` switches to `escalate_model` (via the AI SDK's `experimental_prepareStep`, which fires before every step/LLM call) for the rest of the run - e.g. start on `claude-haiku-4-5` and escalate to a stronger model only if the cheap model is struggling, mirroring how IDE chat agents (Cursor, JetBrains) let you pick different models per turn.

## 1.0.3

### Patch Changes

- Add missing getRunsByMatrixId / matrix_id column export, which was added after 1.0.2 was published but never released.

## 1.0.2

### Patch Changes

- 81eff8a: fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.

## 1.0.1

### Patch Changes

- Fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.

## 1.0.0

### Major Changes

- initial release of the agentgrader cli and core framework.
