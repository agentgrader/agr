---
"agentgrader": patch
---

`agr bench --suite tasks/ --config agent.yaml --only-unrun` runs only test cases with no recorded runs in the DB; prints the selected case names; exits cleanly (code 0) when all cases have runs; the natural companion to `agr list-tests --unrun` and the inverse of `--only-failed`; useful for building initial coverage of a large suite
