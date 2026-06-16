---
"agentgrader": patch
---

`agr bench --only-failed` runs only the test cases that failed on their most recent run in the local DB; enables tight fix-and-retry loops: bench the full suite, fix failing cases, then re-run only those with `--only-failed`; exits cleanly (code 0) when all previously-failed test cases have since passed
