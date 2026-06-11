---
"@agentgrader/agent-openrouter": minor
---

Refactored the default CLI adapter to seamlessly support Anthropic and OpenAI natively. The adapter now reads `config.provider` (e.g. `"anthropic"`, `"openai"`, `"openrouter"`) from your configuration and dynamically instantiates the appropriate AI SDK client, falling back to OpenRouter by default. The internal class has been renamed to `AiSdkAgentAdapter`, but `OpenRouterAgentAdapter` remains available as an alias for backwards compatibility.
