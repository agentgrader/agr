---
"@agentgrader/core": patch
---

`wasCommandUsed` (and `getCommandUsageSource`) now also match `tool_<name>` entries, the first-class AI-SDK tools agent-openrouter registers for each toolkit skill (e.g. `tool_rename_symbol` for `rename-symbol`). Previously only the prompt-described `executeCommand`/`terminal/create` paths were matched, so a toolkit tool invoked via `tool_<name>` was invisible to `metrics["tool-usage"]`/`metrics["tool-adoption"]`, undercounting real adoption.
