---
"agentgrader": patch
---

`agr bench` now accepts `--dry-run`: resolves test cases and agent configs (including matrix expansion), prints the full task x config matrix with total job count, and exits without opening Docker, spending any API budget, or writing to the database. Useful before large bench runs or matrix sweeps to confirm the scope looks right.
