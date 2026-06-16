---
"agentgrader": patch
---

`agr status --by-config` shows a per-config breakdown: solve rate, avg cost, avg duration, and avg tokens per agent config, sorted by solve rate descending; combinable with `--since` and `--test-case` to scope the data; `--json` emits a `byConfig` array; enables A/B analysis across multiple agent configs without running `agr status --config <name>` for each one
