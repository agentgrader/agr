---
"@agentgrader/sandbox-docker": patch
---

`DockerSandboxHandle.destroy()` now logs (instead of silently swallowing) errors from `container.stop()`/`container.remove()`. Previously a failed removal left the sandbox container running with no indication why, which is how stale containers accumulate over many runs - the error is now visible so it can be diagnosed.
