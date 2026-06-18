---
"agentgrader": patch
---

`agr list --json` outputs the run list as a JSON array (fields: `id`, `testCaseId`, `testCaseName`, `agentConfigId`, `agentConfigName`, `agentModel`, `passed`, `costUsd`, `durationMs`, `stepsCount`, `tokensIn`, `tokensOut`, `error`, `matrixId`, `createdAt`, `completedAt`); suppresses plain-text and TUI output; combinable with all existing filters (`--since`, `--test-case`, `--config`, `--passed`, `--failed`, `--limit`)
