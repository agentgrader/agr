---
"agentgrader": patch
---

`agr bench` result summary now distinguishes test failures (agent ran but test didn't pass) from errored runs (sandbox crash), printing separate `Failed:` and `Errored:` lines with the first 60 chars of the error message for crashed runs.
