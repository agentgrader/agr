# agentgrader

## 1.2.0

### Minor Changes

- Add `agr compare <runIdA> <runIdB>` to compare step traces of two runs side by side, with `--full` and `--only-diff` options.

## 1.1.0

### Minor Changes

- Add `--configs-dir` and `--manifest` to `agr bench` for loading multiple agent config files from a directory or a bench manifest YAML with glob support.

## 1.0.7

### Patch Changes

- Truncate long config names in bench dashboard; improve import-pr test-runner detection and clone-fixture messaging; add validate --strict tip when execution checks are skipped.
- Updated dependencies
- Updated dependencies
  - @agentgrader/agent-openrouter@2.0.3
  - @agentgrader/optimizer@0.1.1

## 1.0.6

### Patch Changes

- Bump @agentgrader/store dependency to ^1.0.3 for getRunsByMatrixId export.
- Add --verbose to agr run; CLI help examples; --config alias for bench; improve import-pr scaffolding and validate UX (--strict, skip warnings); clearer run summary for skipped scorers.
- Updated dependencies
- Updated dependencies
  - @agentgrader/core@1.1.3
  - @agentgrader/store@1.0.3

## 1.0.5

### Patch Changes

- `agr run`/`agr validate`/`agr bench` now print a readable, one-issue-per-line summary when an `agr.yaml` test case or agent config YAML fails schema validation, instead of dumping the raw Zod error as JSON.
- Updated dependencies
  - @agentgrader/sandbox-docker@2.0.2

## 1.0.4

### Patch Changes

- 99b8f7d: The `agr` CLI now loads `.env` from the current working directory via `dotenv/config`, so `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`OPENROUTER_API_KEY` set in a project's `.env` file are picked up. Additionally, `AiSdkAgentAdapter` now throws a clear error naming the missing environment variable instead of silently falling back to a `"mock-key"` and failing with a cryptic "Missing Authentication header" from the provider.
- Updated dependencies [99b8f7d]
  - @agentgrader/agent-openrouter@2.0.1

## 1.0.3

### Patch Changes

- 8c85583: Running a command with missing required arguments (e.g. `agr run` with no test case path) now prints a friendly error and the command's help instead of crashing with a raw `CACError` stack trace.
- Updated dependencies [8c85583]
  - @agentgrader/core@1.1.1

## 1.0.2

### Patch Changes

- 81eff8a: fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies [94a1869]
- Updated dependencies [81eff8a]
- Updated dependencies [ef07b0a]
  - @agentgrader/agent-openrouter@2.0.0
  - @agentgrader/core@1.1.0
  - @agentgrader/store@1.0.2
  - @agentgrader/sandbox-docker@2.0.0

## 1.0.1

### Patch Changes

- Fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies
  - @agentgrader/core@1.0.1
  - @agentgrader/store@1.0.1
  - @agentgrader/sandbox-docker@1.0.1
  - @agentgrader/agent-openrouter@1.0.1

## 1.0.0

### Major Changes

- initial release of the agentgrader cli and core framework.

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.0.0
  - @agentgrader/store@1.0.0
  - @agentgrader/sandbox-docker@1.0.0
  - @agentgrader/agent-openrouter@1.0.0
