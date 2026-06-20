---
"agentgrader": patch
---

New `agr cost` command prints total cost for matching runs as a plain dollar amount (e.g. `$1.2345`); supports all the same filters as `agr count` (`--since`, `--test-case`, `--config`, `--model`, `--sandbox`, `--passed`, `--failed`, `--last-matrix`); `--json` emits `{totalCostUsd, avgCostUsd, total, dbPath}`; useful for quick budget checks in CI (`agr cost --last-matrix` after a bench) or shell scripting (`agr cost --since 24h --json | jq .avgCostUsd`)
