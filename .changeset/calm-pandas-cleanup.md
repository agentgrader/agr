---
"@agentgrader/sandbox-docker": minor
"agentgrader": minor
---

`DockerSandboxProvider` now labels every sandbox container with `agentgrader.sandbox=true` and a creation timestamp, and exposes `listSandboxes()`/`removeSandbox()`. The CLI gets a new `agr cleanup` command that lists (or, with `--yes`, removes) leftover sandbox containers - e.g. from a run whose process was killed before its `cleanup` step could call `destroy()`. Combined with `step_timeout_ms`, this gives a way to both prevent and clean up the orphaned `tail -f /dev/null` containers that previously accumulated silently across runs.
