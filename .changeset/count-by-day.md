---
"agentgrader": patch
---

`agr count --by-day 14` prints run counts for the last 14 days, one row per day with passed/failed breakdown; defaults to 7 days; `--json` emits `{days, byDay:[{date,count,passed,failed}]}`; useful for activity graphs and spotting evaluation gaps
