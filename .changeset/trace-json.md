---
"agentgrader": patch
---

`agr trace --json` outputs the run trace as a JSON object; default mode emits `{run, steps[]}`, `--quality` emits `{run, metrics}`, `--tools` emits `{run, toolUsage}`; combinable with `--last`, `--test-case`, and `--config`
