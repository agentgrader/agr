---
"agentgrader": patch
---

`agr watch --count 10` exits with code 0 as soon as exactly 10 new runs (of any status) are seen; useful for "wait until this bench of N test cases completes" without needing to know which test cases passed or failed; complements `--min-pass-count` (gates on passing runs) and `--min-pass-rate` (gates on solve rate)
