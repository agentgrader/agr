---
"agentgrader": patch
---

`agr bench --output-json bench-result.json` writes the full bench result JSON to a file after the bench completes; always produced regardless of `--json` flag; same structure as `--json` stdout output (including `byTestCase`, `byConfig`, `runs`, `gateReasons`); useful in CI when you want both human-readable terminal output and a machine-readable result file for downstream tooling
