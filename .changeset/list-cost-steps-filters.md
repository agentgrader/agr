---
"agentgrader": patch
---

`agr list` now supports `--min-cost <amount>`, `--max-cost <amount>`, `--min-steps <n>`, and `--max-steps <n>` filters; combinable with all existing filters and `--plain`/`--json`; useful for finding expensive outlier runs (`--min-cost 0.10`), cheap runs (`--max-cost 0.005`), runaway step-count agents (`--min-steps 50`), or runs that terminated early (`--max-steps 5`)
