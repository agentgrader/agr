---
"agentgrader": patch
---

`agr bench` now shows `Failed: N cases (see \`agr list\`)` and `Errored: N cases` when more than 10 cases fail or crash, instead of silently omitting the failure detail. Previously the `Failed:` line was only printed for up to 10 failures.
