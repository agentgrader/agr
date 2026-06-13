---
"agentgrader": minor
---

`agr run`, `agr bench`, and `agr validate` now warn on stderr when `agent.yaml` or `agr.yaml` contains a top-level key that the installed `@agentgrader/core` doesn't recognize, e.g. `[WARN] agent config "agent.yaml": unrecognized field(s) "step_timeout_ms" - these are silently ignored. ...`.

This catches a "config version-skew" trap found in the JetBrains feedback loop: zod's `.parse()` silently drops unrecognized keys, so a field your YAML sets (`step_timeout_ms`, `escalate_after_steps`/`escalate_model`, etc.) can have zero effect with no error if `@agentgrader/core` predates that field. The warning makes this immediately visible instead of looking like the field "just doesn't help".
