# @agentgrader/sandbox-docker

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
