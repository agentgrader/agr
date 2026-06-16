---
"agentgrader": patch
---

Improve `agr bench` startup and completion output: config load now prints name+model for `--config`/`--configs`; suite mode prints discovery count; non-matrix runs print a plain-text `Result: N/M PASS (X%) cost: $Y` summary line after the dashboard (useful for CI logs where Ink rendering may not persist). Also fixes singular/plural "config"/"configs" in the shared agent_config log.
