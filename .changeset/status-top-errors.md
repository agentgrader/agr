---
"agentgrader": patch
---

`agr status --top-errors N` prints the top N most frequent error messages as `count\tmessage` lines; `--json` emits `{topErrors:[{message,count}],totalErrors,totalRuns}`; compact triage shortcut vs `--errors` which shows all; scriptable: `agr status --top-errors 5 --since 24h`; combinable with `--since`, `--config`, `--test-case`, and all filter flags
