# @agentgrader/core

## 1.1.0

### Minor Changes

- ef07b0a: add support for passing an array of `adapters: agentadapter[]` to `runbenchmark`, enabling cross-matrix benchmarking of different adapter architectures alongside test cases and agent configs.

### Patch Changes

- 81eff8a: fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies [81eff8a]
  - @agentgrader/store@1.0.2

## 1.0.1

### Patch Changes

- Fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies
  - @agentgrader/store@1.0.1

## 1.0.0

### Major Changes

- initial release of the agentgrader cli and core framework.

### Patch Changes

- Updated dependencies
  - @agentgrader/store@1.0.0
