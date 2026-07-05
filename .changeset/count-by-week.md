---
"agentgrader": patch
---

`agr count --by-week 12` prints run counts for the last 12 weeks (default 4), one row per week with passed/failed breakdown; `--json` emits `{weeks, byWeek:[{week,count,passed,failed}]}`; complement to `agr count --by-day` for long-term trend views
