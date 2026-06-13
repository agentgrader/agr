# @agentgrader/optimizer

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
