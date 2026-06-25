---
"agentgrader": patch
---

`agr bench --min-pass-count 8` exits with code 1 if fewer than 8 runs pass in total; complements `--min-solve-rate` (which is rate-based): `--min-pass-count 1` fails if nothing passed, `--min-pass-count N` requires N absolute successes regardless of total run count; the exit reason is printed at the end of the bench summary
