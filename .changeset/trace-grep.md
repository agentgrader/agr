---
"agentgrader": patch
---

`agr trace --last --grep <pattern>` shows only steps whose label or content contains the pattern (case-insensitive); the header shows `N matching step(s) for "error" of 127 total`; combinable with `--steps` for compound filtering (range first, then grep); useful for finding where a specific error, tool call, or string appears in a long trace
