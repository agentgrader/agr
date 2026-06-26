---
"agentgrader": patch
---

`agr trace --last --output-json trace.json` saves the full trace (run metadata + all steps) as pretty-printed JSON to the given path (parent directories are created automatically); also prints the normal text trace to stdout unless `--json` is also set; useful for post-processing with `jq` or sharing a trace for debugging
