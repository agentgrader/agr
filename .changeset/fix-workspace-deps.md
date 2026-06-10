---
"@agentgrader/core": patch
"@agentgrader/store": patch
"@agentgrader/sandbox-docker": patch
"@agentgrader/agent-openrouter": patch
"agentgrader": patch
---

fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
