---
"agentgrader": patch
---

`agr list --passed` / `agr list --failed` and `agr status --passed` / `agr status --failed` filter runs by outcome; mutually exclusive; mirrors `agr export runs --passed/--failed`; `--failed` in list shows failing runs for triage; `--failed` in status shows cost and avg duration of failing runs
