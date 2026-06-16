---
"agentgrader": patch
---

`agr run <name> --repeat <n>` runs the same test case N times sequentially and prints a solve-rate summary (`X/N PASS (Y%)`, avg cost, avg duration); useful for flakiness testing and verifying statistical consistency of a fix before scaling up with `agr bench`; each run is recorded in the DB and traceable via `agr trace --last --test-case <name>`
