---
"agentgrader": patch
---

`agr watch --exit-on-fail` exits with code 1 as soon as any failing run appears (useful for fail-fast CI patterns); `agr watch --exit-on-pass` exits with code 0 as soon as any passing run appears (useful for waiting until a fix is confirmed); both print a message identifying the triggering run ID before exiting
