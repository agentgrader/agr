---
"agentgrader": minor
---

`agr run` now renders a proper Ink TUI instead of plain `console.log` streaming: a live step list (color-coded by kind - tool calls in blue, tool results in green, messages in white, thinking in gray - truncated to 200 chars, full detail with `--verbose`, a compact step/cost counter without it), a final summary panel (PASS/FAIL, steps, cost, duration, prompt-cache hit rate, error and regression/diff/localization metric lines), and - new - a colorized unified diff of `finalDiff` (green `+`/red `-`/cyan `@@` hunks, capped at 60 lines). Exit codes are unchanged (`0` on a completed run regardless of pass/fail, `1` if `runSingle` throws).

Also removes every emoji/pictographic glyph from CLI output across `agr run`, `agr bench`, `agr validate`, `agr compare`, and the top-level CLI error handler, replacing them with plain bracketed labels (`[OK]`/`[WARN]`/`[FAIL]`, `PASS`/`FAIL`, `[error]`) and Ink/ANSI color - "no emoji anywhere" is now a CLI-wide convention.
