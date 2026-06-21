---
"agentgrader": patch
---

`agr bench --suite tasks/ --config agent.yaml --skip-passing-since 24h` skips test cases that have a passing run within the given time window; prints how many were skipped; exits cleanly when all cases have recent passes; enables incremental bench runs for large suites where only recently-failing or never-run cases need to be re-executed
