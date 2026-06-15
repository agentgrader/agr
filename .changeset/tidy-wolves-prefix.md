---
"@agentgrader/core": patch
---

`bucketToolName` (used by `metrics["tool-usage"]`/`metrics["tool-adoption"]`) now strips one or more leading `cd <dir> &&`/`cd <dir>;` prefixes before taking the command's first word. Previously, `executeCommand`/`terminal/create` calls that `cd` into the project before running the real command (e.g. `cd /app && python -m pytest ...`) bucketed as `executeCommand:cd`, hiding the actual command (`python`) from tool-usage/tool-adoption tracking. A bare `cd <dir>` with nothing after it still buckets as `cd`.
