# @agentgrader/sandbox-docker

## 4.1.0

### Minor Changes

- 49beb87: Toolkits (`toolkits:` in agent config / test case) can now ship an optional
  `setup.sh` at their root, executed once inside the sandbox right after the
  toolkit's `bin/` and `.claude/skills/` files are injected. Use it to install
  dependencies your toolkit's scripts (or the agent itself) need - e.g.
  `pip install pytest` on a bare `python:3.11` image - instead of every
  invocation re-checking/installing them. `setup.sh` is excluded from the
  copy into `/app` so it doesn't show up in `gitDiff()`.

### Patch Changes

- Updated dependencies [631b5af]
- Updated dependencies [4f141ee]
  - @agentgrader/core@1.3.1

## 4.0.0

### Minor Changes

- 0324c8a: Fix the "run stalls with no `RUN SUMMARY` and a leftover container" failure mode at its actual source: `DockerSandboxHandle.exec()` had no timeout at all. Any command that hangs inside the sandbox - an agent-induced infinite loop, a test that never returns, a network install that never connects - blocked `exec()` forever, and with it the entire run (scoring and cleanup included), with zero log output.

  - `exec(cmd, timeoutMs = 180000)`: stops waiting after `timeoutMs` and returns `{ exitCode: 124, timedOut: true }` instead of hanging forever. The process may still be running inside the container; `destroy()` reaps it.
  - `CommandScorer` reports `timedOut` commands with a clear "timed out and was abandoned" message instead of looking like a generic failure.
  - `runSingle`'s `score` step now short-circuits when the agent loop itself errored (e.g. a `step_timeout_ms` abort) - it no longer runs the full test suite against a guaranteed-fail run, which previously risked compounding one hang (the agent loop) with another (an unbounded `sandbox.exec` during scoring).
  - `runSingle`'s `cleanup` step now bounds `sandbox.destroy()` to 60s, so a wedged Docker daemon can no longer block the final `RUN SUMMARY`.

  This was the real cause behind the "stops mid-trace with no RUN SUMMARY" symptom previously attributed only to `generateText` provider hangs (see `step_timeout_ms`): that watchdog correctly aborted the agent loop, but the unguarded scoring-phase `sandbox.exec` of `test_command` against a half-edited fixture could then hang the rest of the run indefinitely with no further output.

- 402cc11: `DockerSandboxProvider` now labels every sandbox container with `agentgrader.sandbox=true` and a creation timestamp, and exposes `listSandboxes()`/`removeSandbox()`. The CLI gets a new `agr cleanup` command that lists (or, with `--yes`, removes) leftover sandbox containers - e.g. from a run whose process was killed before its `cleanup` step could call `destroy()`. Combined with `step_timeout_ms`, this gives a way to both prevent and clean up the orphaned `tail -f /dev/null` containers that previously accumulated silently across runs.

### Patch Changes

- 3d853b6: `DockerSandboxHandle.destroy()` now logs (instead of silently swallowing) errors from `container.stop()`/`container.remove()`. Previously a failed removal left the sandbox container running with no indication why, which is how stale containers accumulate over many runs - the error is now visible so it can be diagnosed.
- Updated dependencies [0324c8a]
- Updated dependencies
- Updated dependencies [8873f9a]
- Updated dependencies [9c911e7]
- Updated dependencies [490e98d]
  - @agentgrader/core@1.3.0

## 3.0.0

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.2.0

## 2.0.2

### Patch Changes

- `DockerSandboxProvider.create()` now pings the Docker daemon first and throws a clear "Could not connect to Docker... Make sure Docker is installed and running." error if it's unreachable, instead of a raw `ENOENT`/`ECONNREFUSED` from a failed image pull.

## 2.0.1

### Patch Changes

- a10f326: Fix `copyDirToContainer` silently hanging forever when invoked from inside a Mastra workflow step. Previously a `tar` child process's stdout stream was piped directly into `dockerode`'s `container.putArchive()`; inside a Mastra step the `putArchive` callback never fired, causing every test case with a fixture to abort `runSingle` with no output, no error, and exit code 0. The tarball is now built into an in-memory buffer via `execFile` and passed to `putArchive` directly.

## 2.0.0

### Patch Changes

- 81eff8a: fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies [81eff8a]
- Updated dependencies [ef07b0a]
  - @agentgrader/core@1.1.0

## 1.0.1

### Patch Changes

- Fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies
  - @agentgrader/core@1.0.1

## 1.0.0

### Major Changes

- initial release of the agentgrader cli and core framework.

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.0.0
