---
"agentgrader": patch
---

`agr list --matrix-id <id>` and `agr list --last-matrix` filter the run list to a single bench matrix sweep; mirrors the same flags on `agr export runs` so you can browse a sweep interactively or in plain/JSON mode without first exporting (e.g. `agr list --last-matrix --plain`)
