---
"agentgrader": patch
---

`agr list --sandbox <provider>` filters the run list to runs with a matching sandbox provider substring (e.g. `--sandbox e2b` or `--sandbox docker`); mirrors `agr status --by-sandbox` for filter symmetry and is combinable with all other `agr list` flags
