---
"agentgrader": minor
---

`agr bench` now accepts optional positional test case names/paths (same resolution forms as `agr run` and `agr validate`). Pass one or more names without `--suite` to resolve them directly (`agr bench hello-world --matrix matrix.yaml`), or alongside `--suite` to filter the loaded suite to a named subset (`agr bench task-a task-b --suite tasks/ --configs agent.yaml`).
