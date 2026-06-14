---
"@agentgrader/sandbox-docker": minor
---

Toolkits (`toolkits:` in agent config / test case) can now ship an optional
`setup.sh` at their root, executed once inside the sandbox right after the
toolkit's `bin/` and `.claude/skills/` files are injected. Use it to install
dependencies your toolkit's scripts (or the agent itself) need - e.g.
`pip install pytest` on a bare `python:3.11` image - instead of every
invocation re-checking/installing them. `setup.sh` is excluded from the
copy into `/app` so it doesn't show up in `gitDiff()`.
