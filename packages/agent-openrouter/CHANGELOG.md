# @agentgrader/agent-openrouter

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
