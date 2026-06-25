---
"agentgrader": patch
---

`agr status --by-test-case --sort-by last-pass` sorts test cases by when they most recently passed (most recently first); test cases that have never passed sort last; best combined with `--show-last-pass` to see the timestamps; completes the `--sort-by` field set alongside `solve-rate`, `cost`, `runs`, and `duration`
