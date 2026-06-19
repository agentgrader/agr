---
"agentgrader": patch
---

`agr bench --config-filter <name>` filters loaded agent configs by name substring (case-insensitive) after loading from `--configs-dir` or `--manifest`; useful for running a subset of a config directory without editing files or listing paths explicitly (e.g. `--configs-dir ./agents --config-filter fast`)
