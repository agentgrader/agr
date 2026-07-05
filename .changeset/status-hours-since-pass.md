---
"agentgrader": patch
---

`agr status --hours-since-pass` prints the number of full hours since the most recent passing run as a plain integer; returns `-1` when no passing run exists; `--json` emits `{hoursSincePass,lastPassAt}`; combinable with `--test-case` and `--config`; useful in CI alerting: `if [ $(agr status --hours-since-pass) -gt 24 ]; then alert; fi`
