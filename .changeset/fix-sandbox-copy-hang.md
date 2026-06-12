---
"@agentgrader/sandbox-docker": patch
---

Fix `copyDirToContainer` silently hanging forever when invoked from inside a Mastra workflow step. Previously a `tar` child process's stdout stream was piped directly into `dockerode`'s `container.putArchive()`; inside a Mastra step the `putArchive` callback never fired, causing every test case with a fixture to abort `runSingle` with no output, no error, and exit code 0. The tarball is now built into an in-memory buffer via `execFile` and passed to `putArchive` directly.
