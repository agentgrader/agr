---
"agentgrader": patch
---

`agr status --by-test-case --below 100` filters breakdown output to entries with solve rate strictly below n%; works with `--by-config` and `--by-model` too; `--below 100` shows anything with at least one failure, `--below 50` shows entries failing more than half the time; combinable with `--top`, `--sort-by`, `--since`, and all filter flags
