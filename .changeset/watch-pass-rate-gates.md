---
"agentgrader": patch
---

`agr watch --min-pass-rate 0.8` exits with code 0 as soon as the rolling solve rate across all seen runs reaches 80%; `agr watch --min-pass-count 5` exits with code 0 as soon as at least 5 passing runs have been seen; both are useful for scripting "wait until the bench reaches a target quality level"
