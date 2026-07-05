---
"agentgrader": patch
---

`agr count --active` counts currently-running runs and prints a plain integer (useful in scripts: `ACTIVE=$(agr count --active)`); `--json` emits `{active, dbPath}`; `agr count --by-sandbox` prints a count per sandbox provider sorted by total runs; `--json` emits `{total, bySandbox: [{sandbox, count}]}`
