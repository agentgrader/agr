---
"@agentgrader/core": patch
"agentgrader": patch
---

`metrics["tool-adoption"]`/`metrics["tool-usage"]` now record `usedVia: "direct" | "wrapped"` per tool, via the new `getCommandUsageSource` (refactored from `wasCommandUsed`). `agr trace --quality` prints `OK (called directly)` vs. `OK (via another tool's output)` vs. `MISSING` per required/tracked tool, falling back to `OK (mechanism not recorded for this run)` for runs predating this change. Previously both cases were reported identically as `OK`, making it impossible to tell whether a required tool was actually invoked or only credited because a composite tool wrapped it.
