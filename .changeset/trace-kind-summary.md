---
"agentgrader": patch
---

`agr trace --last --kind-summary` shows a compact table counting all steps by kind (e.g. `llm_response`, `tool_call`, `tool_result`) with a proportional bar chart; `--json` emits `{run, total, kinds: [{kind, count}]}`; gives a structural overview of what the agent did without reading through the full trace
