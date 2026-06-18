---
"agentgrader": patch
---

`agr cleanup --json` outputs the result as a JSON object `{found, removed, containers[]}` with `{id, image, status, ageMs}` per container; without `--yes` lists containers without removing; with `--yes` reports which were successfully removed
