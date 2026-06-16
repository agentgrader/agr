---
"@agentgrader/optimizer": patch
"agentgrader": patch
---

`agr bench --save-baseline` now records `avgTokensIn` and `avgTokensOut`; `agr compare-baseline` output shows `Avg tokens in` and `Avg tokens out` rows with percentage deltas when token data is available.
