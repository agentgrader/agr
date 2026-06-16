---
"agentgrader": patch
---

`agr run --json` outputs the run result as a single JSON object and suppresses the live Ink UI, making it easy to use in scripts and CI pipelines (e.g. `result=$(agr run hello-world --json); echo $result | jq .passed`)
