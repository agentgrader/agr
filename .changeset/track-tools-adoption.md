---
"@agentgrader/core": patch
"@agentgrader/cli": patch
---

Add an optional `track_tools` agent config field for non-gating toolkit-tool
adoption analytics. Listed command names are checked the same way as
`require_tools_before_submit`, but the result only annotates
`metrics["tool-usage"]` (used/unused breakdown) without affecting
`metrics["tool-adoption"]` or pass/fail. `agr trace --quality` now prints a
"Tool usage (track_tools)" section when this metric is present. Useful for
watching adoption trends of optional toolkit tools (e.g. a new
`show-call-hierarchy`) over many runs without making them required.
