---
"@agentgrader/agent-openrouter": patch
---

Fix `resolveProvider` to no longer treat `OPENAI_API_KEY` as a signal that OpenRouter is configured. Previously, setting only `OPENAI_API_KEY` (no `OPENROUTER_API_KEY`) for a `gpt-`/`o`-series model resolved to provider `"openrouter"`, which then called OpenRouter's API using the OpenAI key and failed. Now only `OPENROUTER_API_KEY` short-circuits the native-provider checks, so a `gpt-`/`o`-series model with only `OPENAI_API_KEY` correctly resolves to provider `"openai"`.
