---
"agentgrader": patch
---

`agr bench --output-run-ids run-ids.txt` writes all completed run IDs to a file (one per line) after the bench and prints a confirmation; useful in CI where stdout capture is awkward (e.g., GitHub Actions `$GITHUB_OUTPUT`); complements `--print-ids` which writes to stdout
