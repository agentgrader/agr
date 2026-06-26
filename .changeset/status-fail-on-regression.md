---
"agentgrader": patch
---

`agr status --regression --fail-on-regression` exits with code 1 if any test cases have regressed; enables direct use as a CI gate step (e.g. in `agr init --ci` workflows): `agr status --regression --fail-on-regression` after a bench run catches regressions before merging a PR
