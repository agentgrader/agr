# @agentgrader/optimizer

## 3.0.0

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.4.0

## 2.0.2

### Patch Changes

- 4e841b5: `agr bench --save-baseline` now records `avgTokensIn` and `avgTokensOut`; `agr compare-baseline` output shows `Avg tokens in` and `Avg tokens out` rows with percentage deltas when token data is available.
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
- Updated dependencies [9f387b8]
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
  - @agentgrader/core@1.3.2

## 2.0.1

### Patch Changes

- 3b2181d: `expandMatrix` now passes `base.track_tools` through to each generated
  `AgentConfig`, matching the existing `require_tools_before_submit`
  pass-through. Without this, `track_tools` set in a `--matrix` YAML's `base`
  was silently dropped and `metrics["tool-usage"]` was never populated for
  matrix-bench runs.
- Updated dependencies [631b5af]
- Updated dependencies [4f141ee]
  - @agentgrader/core@1.3.1

## 2.0.0

### Minor Changes

- 490e98d: Add `step_timeout_ms` to `agent_config` (default 120000ms), wired into `generateText`'s `abortSignal` in `@agentgrader/agent-openrouter`. Previously a single stalled provider request (no response, no error) left the entire run - and its sandbox container - hanging forever with no result and no cleanup, since the hang happens inside an awaited call that never settles and the surrounding try/catch never fires. With a timeout, the call aborts, the error is logged, and the workflow proceeds to scoring and `cleanup` (which destroys the sandbox). Also added as a matrix dimension/base field in `@agentgrader/optimizer`.

### Patch Changes

- Updated dependencies [0324c8a]
- Updated dependencies
- Updated dependencies [8873f9a]
- Updated dependencies [9c911e7]
- Updated dependencies [490e98d]
  - @agentgrader/core@1.3.0

## 1.0.0

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.2.0

## 0.1.1

### Patch Changes

- Add optional `provider` field to matrix base and dimensions; pass through to expanded AgentConfig.
