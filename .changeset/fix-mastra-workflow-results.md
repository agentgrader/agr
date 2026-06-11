---
"@agentgrader/core": patch
---

Fixed `runSingle` and `runBenchmark` reading workflow results from a non-existent `res.results` field (the installed `@mastra/core` version exposes per-step output under `res.steps.<id>.output`, not `res.results`). Previously every run silently reported `passed: false, score: 0` regardless of the actual outcome, and `runBenchmark` always returned an empty `runs` array.
