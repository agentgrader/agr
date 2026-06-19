---
"agentgrader": patch
---

`agr trace --last` gains `--model <substring>`, `--passed`, and `--failed` scope flags; combine them to find and trace the most recent run matching multiple criteria (e.g. `agr trace --last --model haiku --failed` traces the most recent haiku run that failed)
