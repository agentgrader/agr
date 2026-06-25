---
"agentgrader": patch
---

New `agr prune --before <duration|date> --yes` command deletes runs and their traces older than the given cutoff; `--dry-run` previews without deleting; `--yes` confirms deletion; `--json` emits `{deleted, cutoff, dbPath}`; useful for keeping the database lean after long eval campaigns (e.g. `agr prune --before 30d --yes`)
