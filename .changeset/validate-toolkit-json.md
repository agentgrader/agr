---
"agentgrader": patch
---

`agr validate-toolkit --json` outputs the audit result as a JSON object `{dir, passed, findings[]}` with `{file, severity, rule, message}` per finding; exits with code 1 on failure (same as human mode); combinable with `--strict`
