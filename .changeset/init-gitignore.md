---
"agentgrader": patch
---

`agr init` now creates a `.gitignore` in the scaffolded directory (skipped if one already exists) that ignores `.agr/` (run history and exports) and `.env`, preventing accidental commits of the local SQLite database.
