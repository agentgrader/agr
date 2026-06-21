---
"agentgrader": patch
---

`agr export runs --deduplicate --format csv --output snapshot.csv` keeps only the most recent run per (test case, agent config) pair before exporting; mirrors `agr list --latest`; useful for creating current-state snapshots for downstream analysis or training datasets without needing to manually deduplicate
