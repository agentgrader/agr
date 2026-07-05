---
"agentgrader": patch
---

`agr count --by-hour 12` prints run counts for the last 12 hours (default 24), one row per hour with passed/failed breakdown; `--json` emits `{hours, byHour:[{hour,count,passed,failed}]}`; hour label is the UTC ISO hour string; completes the time-series trio alongside `--by-day` and `--by-week`
