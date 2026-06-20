---
"agentgrader": patch
---

`agr trace --last --kind llm_response` filters steps to those with an exact kind match (e.g. `llm_response`, `tool_call`, `tool_result`); the header shows `N step(s) of kind "llm_response" of M total`; combinable with `--steps`, `--grep`, `--full`, `--top-cost`, and all run-selection flags; cleaner than `--grep` when you know the exact step type and don't want false positives from content matches
