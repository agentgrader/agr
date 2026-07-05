---
"agentgrader": patch
---

`agr count --today` prints the number of runs since local midnight as a plain integer; `--json` emits `{today,passed,failed,errored,date}`; quick daily activity check: `COUNT=$(agr count --today --json | jq .passed)`; no `--since` required; combinable with `--test-case`, `--config`, and all filter flags
