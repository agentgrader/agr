---
"agentgrader": patch
---

`agr status --total-tokens` prints total token count (tokensIn + tokensOut) across all matching runs as a plain integer; `--json` emits `{tokensIn,tokensOut,totalTokens,totalRuns}`; useful for tracking API usage: `TOKENS=$(agr status --total-tokens --since 7d)`
