---
"agentgrader": patch
---

`agr count --this-week` prints the number of runs since Monday midnight local time as a plain integer; `--json` emits `{thisWeek,passed,failed,errored,weekStart}`; weekly throughput check: `agr count --this-week --json | jq .passed`; no `--since` required; combinable with `--test-case`, `--config`, and all filter flags
