---
"agentgrader": patch
---

`agr export runs` now includes `status`, `error`, `sandboxProvider`, and `createdAt` in the default output alongside existing fields; these can be selected individually with `--columns status,error,createdAt`; the `error` field is useful for distinguishing agent failures from infrastructure errors; `createdAt` enables time-series analysis
