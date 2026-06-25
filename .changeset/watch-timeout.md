---
"agentgrader": patch
---

`agr watch --timeout 300` exits with code 2 if no new run appears within 300 seconds; useful in CI to detect stalled bench processes (e.g. if the bench crashes without writing any runs, watch won't wait forever); resets the timeout counter each time a new run appears
