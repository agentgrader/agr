---
"agentgrader": patch
---

Running a command with missing required arguments (e.g. `agr run` with no test case path) now prints a friendly error and the command's help instead of crashing with a raw `CACError` stack trace.
