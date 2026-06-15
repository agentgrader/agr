---
"agentgrader": patch
---

`agr run` now exits with a clear error when no agent config is available (neither `--config` on the CLI nor `agent_config:` in the test case's `agr.yaml`), instead of silently falling back to a hardcoded `gpt-4o-mini` baseline that required an unrelated API key. Behaviour now matches `agr bench`, which already errored in this situation.
