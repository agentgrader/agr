---
"agentgrader": patch
---

`agr bench --suite` and `agr validate --suite` now print `agr list-tests <dir>` as a debug hint when no test cases are found or no cases match the tag filter, instead of exiting silently.
