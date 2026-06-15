---
"agentgrader": patch
---

`agr run` now prints the resolved `agr.yaml` path alongside the test case name in its startup line, so name-based resolution is transparent. `agr bench` prints which test cases were loaded (direct-resolution mode) or which subset was kept after filtering (suite + positional names).
