---
"agentgrader": patch
---

New `agr watch` command polls `.agr/db.sqlite` every N seconds (default 3) and prints new runs as they appear; skips all pre-existing runs so only newly completed runs are shown; supports `--test-case`, `--config`, and `--interval` filters; `--json` emits one JSON line per run (NDJSON) for piping to `jq`; useful for monitoring a long bench from a second terminal without the full Ink dashboard
