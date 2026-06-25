---
"agentgrader": patch
---

`agr run hello-world --show-trace` prints all trace steps with content previews after the run completes; useful in CI where the interactive TUI is not available; output matches what `agr trace --last` would show but inline in the run command output
