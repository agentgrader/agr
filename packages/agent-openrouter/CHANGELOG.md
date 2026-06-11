# @agentgrader/agent-openrouter

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
