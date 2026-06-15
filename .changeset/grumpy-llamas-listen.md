---
"agentgrader": patch
---

`agr validate <testCase>` now accepts the same path/directory/name forms as `agr run` (resolved via `resolveTestCasePath`), so `agr validate hello-world` works without typing the full path to `agr.yaml`.
