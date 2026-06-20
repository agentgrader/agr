---
"agentgrader": patch
---

`agr list --latest` deduplicates the run list to show only the most recent run per (test case, agent config) pair, giving a current-state snapshot rather than full history; combinable with `--plain`, `--json`, `--passed`, `--failed`, `--test-case`, `--config`, `--model`, and all other filters; useful for a quick "how is everything doing right now" view without needing `agr status --by-test-case`
