---
"agentgrader": patch
---

`agr run --report-dir <dir>` and `agr bench --report-dir <dir>` auto-generate a timestamped report filename (`run-<timestamp>.<ext>` / `bench-<timestamp>.<ext>`) under the given directory when `--output` is not specified; useful in CI where you always want a report artifact but do not want to hardcode the filename
