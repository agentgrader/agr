---
"agentgrader": patch
---

`agr run` next/inspect hint now uses the actual run ID (`agr trace <runId>`) instead of `--last`, so the reference stays stable even after subsequent runs.
