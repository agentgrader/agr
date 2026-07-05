---
"agentgrader": patch
---

`agr status --pass-streak` prints the number of consecutive passing runs from the most recent as a plain integer; 0 if the latest run failed or no runs exist; `--json` emits `{passStreak,totalRuns}`; CI gate: `if [ $(agr status --pass-streak) -lt 3 ]; then skip_deploy; fi`; combinable with `--since`, `--config`, `--test-case`, and all filter flags
