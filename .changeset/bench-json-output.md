---
"agentgrader": patch
---

`agr bench --json` outputs the full bench result as a single JSON object and suppresses the live Ink dashboard, making it easy to consume bench results in scripts and CI pipelines (e.g. `result=$(agr bench --suite tasks/ --json); echo $result | jq .solveRate`)
