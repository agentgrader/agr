---
"@agentgrader/core": minor
"@agentgrader/sandbox-docker": minor
---

Fix the "run stalls with no `RUN SUMMARY` and a leftover container" failure mode at its actual source: `DockerSandboxHandle.exec()` had no timeout at all. Any command that hangs inside the sandbox - an agent-induced infinite loop, a test that never returns, a network install that never connects - blocked `exec()` forever, and with it the entire run (scoring and cleanup included), with zero log output.

- `exec(cmd, timeoutMs = 180000)`: stops waiting after `timeoutMs` and returns `{ exitCode: 124, timedOut: true }` instead of hanging forever. The process may still be running inside the container; `destroy()` reaps it.
- `CommandScorer` reports `timedOut` commands with a clear "timed out and was abandoned" message instead of looking like a generic failure.
- `runSingle`'s `score` step now short-circuits when the agent loop itself errored (e.g. a `step_timeout_ms` abort) - it no longer runs the full test suite against a guaranteed-fail run, which previously risked compounding one hang (the agent loop) with another (an unbounded `sandbox.exec` during scoring).
- `runSingle`'s `cleanup` step now bounds `sandbox.destroy()` to 60s, so a wedged Docker daemon can no longer block the final `RUN SUMMARY`.

This was the real cause behind the "stops mid-trace with no RUN SUMMARY" symptom previously attributed only to `generateText` provider hangs (see `step_timeout_ms`): that watchdog correctly aborted the agent loop, but the unguarded scoring-phase `sandbox.exec` of `test_command` against a half-edited fixture could then hang the rest of the run indefinitely with no further output.
