# @agentgrader/core

## 1.1.2

### Patch Changes

- `AgentConfigSchema` now accepts an optional `provider` field. Previously this field was silently stripped by Zod during validation, so setting `provider: anthropic` (or `openai`) in an agent config YAML had no effect and the adapter always fell back to the `openrouter` default.

## 1.1.1

### Patch Changes

- 8c85583: Fixed `runSingle` and `runBenchmark` reading workflow results from a non-existent `res.results` field (the installed `@mastra/core` version exposes per-step output under `res.steps.<id>.output`, not `res.results`). Previously every run silently reported `passed: false, score: 0` regardless of the actual outcome, and `runBenchmark` always returned an empty `runs` array.

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
