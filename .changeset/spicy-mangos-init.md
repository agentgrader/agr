---
"agentgrader": minor
---

New `agr init [dir] [--force]` command scaffolds a minimal, runnable project: a `agent.yaml` agent config (`claude-haiku-4-5-20251001`, `provider: anthropic`) plus a tiny self-contained `tasks/hello-world` test case (implement `add(a, b)` in `math.js` so `node --test math.test.js` passes - no `npm install`/`pip install` required inside the sandbox). Refuses to overwrite an existing `agent.yaml` unless `--force` is passed, and prints next-step instructions (`agr run tasks/hello-world/agr.yaml --config agent.yaml --verbose`) so a new user can try `agr run` immediately.
