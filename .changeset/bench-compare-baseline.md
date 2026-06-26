---
"agentgrader": patch
---

`agr bench --suite tasks/ --config agent.yaml --compare-baseline baselines/main.json` automatically compares the bench result against a saved baseline snapshot and prints a Markdown report after the bench completes; equivalent to running `agr compare-baseline --current baselines/main.json` afterwards but in a single command; combine with `--fail-on-failure` to gate CI on regressions
