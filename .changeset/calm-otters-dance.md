---
"agentgrader": minor
---

Add `agr list` command: an interactive TUI for browsing saved runs from `.agr/db.sqlite`, viewing run details (diff, trace preview), and comparing the diffs of two runs side by side. Use `--plain` for a non-interactive text listing, or `--limit`/`--db` to adjust the source.

The interactive UI runs in the terminal's alternate screen buffer with a responsive column layout that adapts to the terminal width, fixed-height panels to avoid scroll jitter, and a full screen clear on navigation or resize so stale content never lingers. The run detail view lets you switch between the diff and trace panes with `Tab`/`t`, each with independent scrolling.
