---
"@agentgrader/optimizer": patch
---

`expandMatrix` now passes `base.track_tools` through to each generated
`AgentConfig`, matching the existing `require_tools_before_submit`
pass-through. Without this, `track_tools` set in a `--matrix` YAML's `base`
was silently dropped and `metrics["tool-usage"]` was never populated for
matrix-bench runs.
