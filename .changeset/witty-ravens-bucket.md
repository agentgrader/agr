---
"agentgrader": patch
---

Bucket `executeCommand` (AI SDK adapter) and `terminal/create` (ACP adapter) calls by the first word of the command in `agr trace --tools` and the `agr bench` `TOOL USAGE BY CONFIG` footer (e.g. `executeCommand:find-usages`, `terminal/create:pytest` instead of one opaque `executeCommand`/`terminal/create` bucket). Previously, a custom toolkit's CLI tools were indistinguishable from generic shell exploration (`find`, `grep`, `cat`, ...) in tool-usage breakdowns, making it impossible to measure adoption of toolkit-provided commands for either adapter.
