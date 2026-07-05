---
"agentgrader": patch
---

`agr list --min-passes N` filters the run list to only show runs whose test case has at least N passing runs across all history; useful for narrowing to test cases that have been validated: `agr list --plain --min-passes 3 --failed` shows failures on well-exercised test cases
