---
"@agentgrader/agent-openrouter": patch
---

Fix prompt-cache token accounting in `onStepFinish`: Anthropic's `usage.promptTokens` (`input_tokens`) already excludes `cache_read`/`cache_creation` tokens, but `onStepFinish` subtracted them again, clamping the fresh-token cost term to ~0 and undercounting step cost. It also emitted `tokensIn` as the fresh-only count while `cachedTokens` came from a separate, often-larger pool, producing >100% "prompt cache hit rate" in `agr trace` and the run summary. `tokensIn` is now `promptTokens + cacheRead + cacheCreation` (total input tokens), so `cachedTokens <= tokensIn` always holds. Also adds a `claude-haiku-4-5`/`claude-sonnet-4` pricing case to `getPricing()`, which previously fell through to the unknown-model default ($2/$10 per 1M vs. actual $1/$5 for Haiku 4.5).
