---
"agentgrader": patch
---

`agr compare --first-and-last` compares the oldest and most recent run (useful for tracking progress over time); combine with `--test-case` to scope to a single task (`agr compare --first-and-last --test-case hello-world --only-diff`); supports all the same output options as `--last-two` including `--full`, `--only-diff`, and `--json`
