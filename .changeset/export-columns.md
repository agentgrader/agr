---
"agentgrader": patch
---

`agr export runs --columns id,testCaseId,passed,costUsd --format csv` selects which columns to include in the export output; unknown column names print a warning and are ignored; valid columns: `id`, `testCaseId`, `agentConfigId`, `passed`, `costUsd`, `durationMs`, `stepsCount`, `tokensIn`, `tokensOut`, `matrixId`, `metrics`; applies to CSV, JSON, and JSONL formats; omitting `metrics` avoids large JSON blobs that make CSV files difficult to work with in spreadsheets
