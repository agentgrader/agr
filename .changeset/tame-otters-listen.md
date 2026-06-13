---
"agentgrader": patch
---

Add `require_tools_before_submit: string[]` to agent config: a list of command names (e.g. a toolkit's `run-tests`, or a generic `pytest`/`biome`) that should have been invoked at least once before `submit`. Checked against `executeCommand`/`terminal/create` first-words and direct tool names via the new `wasCommandUsed` helper. Never blocks the run - purely annotates `metrics["tool-adoption"]` (`{ passed, detail, required, missing }`), surfaced by `agr trace --quality` and a new `TOOL ADOPTION BY CONFIG` footer in `agr bench`. Lets users measure whether a custom toolkit's tools are configured but unused, without manually grepping trace output.
