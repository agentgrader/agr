---
"@agentgrader/agent-openrouter": minor
---

Add `experimental_repairToolCall` to the AI SDK agent loop: if the model calls a tool name that isn't registered (e.g. a toolkit/skill CLI command like `find-usages` that's only runnable via `executeCommand`, not a first-class tool), the call is replayed as `executeCommand "<toolName> <args...>"` instead of aborting the entire run with `NoSuchToolError`. Previously a single hallucinated tool name (common with smaller models like Haiku) would terminate the run after only a few steps with a generic error.
