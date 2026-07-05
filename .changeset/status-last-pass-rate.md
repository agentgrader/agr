---
"agentgrader": patch
---

`agr status --last-pass-rate 20` prints the solve rate of the last N runs as a plain 4-decimal number; `--json` emits `{lastPassRate,passed,window,requested,totalRuns}`; recent-window snapshot useful when historical rate looks good but recent runs are regressing: `RECENT=$(agr status --last-pass-rate 20)`; combinable with `--since`, `--config`, `--test-case`, and all filter flags
