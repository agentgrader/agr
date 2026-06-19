---
"agentgrader": patch
---

`agr export runs` gains `--model <name>` (filter by model substring, same as `agr list --model`) and `--sort <field>` (sort by date, cost, duration, or steps before applying `--limit`); useful for exporting only haiku runs sorted by cost for post-hoc analysis
