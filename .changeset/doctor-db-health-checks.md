---
"agentgrader": patch
---

`agr doctor` now includes two DB health checks when `.agr/db.sqlite` exists: (1) **Database size** -- warns at 100 MB and suggests `agr prune`, fails above 500 MB; (2) **Errored runs** -- warns when more than 10 runs crashed before scoring (indicating connectivity or sandbox issues)
