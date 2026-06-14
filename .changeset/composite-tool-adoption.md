---
"@agentgrader/core": patch
---

`require_tools_before_submit` adoption checks now also count a tool as
"used" if a tool_result's output contains a `<name>: ` marker line, even
when the agent never invoked `<name>` directly. This lets a composite
toolkit tool (e.g. a `rename-symbol` that runs `run-tests` internally after
renaming) satisfy adoption for the tool it wraps, as long as the wrapped
tool prints a self-identifying output line.
