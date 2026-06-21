---
"agentgrader": patch
---

`agr count --errored` counts runs that crashed before scoring (status "failed" with no pass/fail verdict, distinct from `--failed` which counts scored failures); combinable with `--since`, `--test-case`, `--config`, and all other count filters; useful for CI monitoring of infrastructure errors vs evaluation failures
