---
"agentgrader": patch
---

Fix `expandMatrix` silently dropping `base.require_tools_before_submit`: it was missing from `MatrixBaseSchema` (so zod stripped it) and from the per-combination `AgentConfig` it builds, so `metrics["tool-adoption"]` never appeared for `agr bench --matrix` runs even when configured in `base`.
