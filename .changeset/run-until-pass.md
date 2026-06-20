---
"agentgrader": patch
---

`agr run --until-pass` runs a test case repeatedly until it passes, stopping immediately on the first passing attempt; `--max-attempts N` caps the total (default 5); prints per-attempt status (`PASS`/`FAIL`/`ERROR`) and a summary showing which attempt passed and total cost; `--json` emits `{passed, attempts, maxAttempts, totalCostUsd, runs[]}`; useful for verifying that a flaky fix actually works without manually re-running
