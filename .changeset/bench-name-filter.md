---
"agentgrader": patch
---

`agr bench --suite tasks/ --name <substring>` filters test cases by name substring (case-insensitive), applied after `--tags` and `--skip-tags`; useful for quickly running a subset of a large suite without listing every case explicitly
