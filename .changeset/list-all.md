---
"agentgrader": patch
---

`agr list --all` loads every run from the database ignoring the default 100-run cap; useful with `--plain`, `--json`, and `--sort` when you need the full run history (e.g. `agr list --all --json | jq length`)
