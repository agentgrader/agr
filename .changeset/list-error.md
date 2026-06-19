---
"agentgrader": patch
---

`agr list --error <substring>` filters runs to those whose error message contains the given substring (case-insensitive); useful for finding all runs that failed with a specific error type (e.g. `--error timeout`, `--error rate limit`); combinable with all other `agr list` flags
