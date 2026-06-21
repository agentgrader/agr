---
"agentgrader": patch
---

`agr trace --last --step-count` prints the total step count as a plain number; `--json` emits `{stepCount, filteredCount, runId}`; combinable with all run-selection flags (`--last`, `--test-case`, `--config`, `--passed`, `--failed`); useful in CI for asserting agent step budgets (`if [ $(agr trace --last --step-count) -gt 50 ]; then echo "Too many steps"; fi`)
