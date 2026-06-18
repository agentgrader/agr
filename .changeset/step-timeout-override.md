---
"agentgrader": patch
---

`agr run --step-timeout <ms>` and `agr bench --step-timeout <ms>` override `step_timeout_ms` for this run without editing the agent YAML; useful in CI to cap per-LLM-call latency and abort stuck provider requests faster than the default 120s
