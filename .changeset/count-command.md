---
"agentgrader": patch
---

`agr count` prints the number of runs matching the given filters as a plain number (or `--json` for `{total, passed, failed, dbPath}`); supports the same filters as `agr list` (`--since`, `--test-case`, `--config`, `--model`, `--sandbox`, `--passed`, `--failed`, `--matrix-id`, `--last-matrix`); useful for CI badges, shell conditions, and quick sanity checks without launching the TUI
