---
"agentgrader": patch
---

`agr status --avg-steps` prints the average step count per run as a plain decimal (scriptable: `AVG=$(agr status --avg-steps)`); `--fastest-config` and `--slowest-config` print the config ID with the lowest/highest average duration per run; all three support `--json` and all standard filter flags
